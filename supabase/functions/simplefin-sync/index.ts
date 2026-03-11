import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  decodeByteaToString,
  decryptString,
  parseSerializedEncryptedPayload,
} from "../_shared/crypto.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getCronSecret, getSimplefinConfig, getSupabaseConfig } from "../_shared/env.ts";
import { normalizeMerchantForRecurring } from "../_shared/merchant.ts";
import {
  evaluateOwnerRulesV1,
  type OwnerRuleV1,
  type OwnerValueV1,
  type TransactionOwnerRuleInputV1,
} from "../_shared/owner_rules_v1.ts";
import { evaluateRulesV1, type CategoryRuleV1, type TransactionRuleInputV1 } from "../_shared/rules_v1.ts";
import { fetchAccounts } from "../_shared/simplefin.ts";

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } =
  getSupabaseConfig();
const { encKey: SIMPLEFIN_ENC_KEY, keyByKid: SIMPLEFIN_KEYS_BY_KID } = getSimplefinConfig();
const CRON_SECRET = getCronSecret();

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-cron-secret";
const ALLOW_METHODS = "POST, OPTIONS";
const FUNCTION_NAME = "simplefin-sync";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ConnectionRow = {
  id: string;
  user_id: string;
  token_enc: string | null;
  token_kid: string | null;
};

type AccountRow = {
  id: string;
};

type UserPreference = {
  rawDescriptionDays: number;
  retentionMonths: number;
};

type ImportedTransactionSnapshot = {
  accountId: string;
  providerTransactionId: string;
  amount: number;
  merchantCanonical: string | null;
  merchantNormalized: string | null;
  descriptionShort: string;
};

type StoredTransactionForRules = {
  id: string;
  provider_transaction_id: string;
  account_id: string;
  amount: number | string;
  owner: string | null;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  description_short: string;
  category_id: string | null;
  user_category_id: string | null;
  category_source: "user" | "rule" | "auto" | "import" | "unknown" | null;
  classification_rule_ref: string | null;
  classification_explanation: string | null;
};

type TransactionMatchRow = {
  id: string;
  posted_at: string;
  authorized_at: string | null;
  amount: number | string;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  description_short: string;
};

const STALE_PENDING_DAYS = 7;
const PENDING_MATCH_WINDOW_DAYS = 10;
const AMOUNT_EPSILON = 0.01;
const MAX_FORCE_ARCHIVE_PENDING_DAYS = 90;

type SyncRequestOptions = {
  forceArchivePendingDays: number | null;
};

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req, {
        allowHeaders: ALLOW_HEADERS,
        allowMethods: ALLOW_METHODS,
      }),
      "Content-Type": "application/json",
    },
  });
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function toIsoDate(value: unknown, fallbackIso: string): string {
  const minimumReasonableYear = 2000;

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number.parseFloat(trimmed);
      return toIsoDate(numeric, fallbackIso);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf()) && parsed.getUTCFullYear() >= minimumReasonableYear) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) {
      return fallbackIso;
    }
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.valueOf()) && parsed.getUTCFullYear() >= minimumReasonableYear) {
      return parsed.toISOString();
    }
  }

  return fallbackIso;
}

function addDays(isoDate: string, days: number): string {
  const parsed = new Date(isoDate);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString();
}

async function parseSyncRequestOptions(req: Request): Promise<SyncRequestOptions> {
  const contentLength = req.headers.get("content-length");
  if (contentLength === "0") {
    return { forceArchivePendingDays: null };
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Allow empty body and non-JSON callers.
    return { forceArchivePendingDays: null };
  }

  const record = asRecord(body);
  if (!record) {
    return { forceArchivePendingDays: null };
  }

  const rawValue = record.force_archive_pending_days;
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { forceArchivePendingDays: null };
  }

  const parsedValue = typeof rawValue === "number"
    ? rawValue
    : typeof rawValue === "string"
    ? Number.parseInt(rawValue, 10)
    : Number.NaN;

  if (!Number.isFinite(parsedValue) || parsedValue < 1 || parsedValue > MAX_FORCE_ARCHIVE_PENDING_DAYS) {
    throw new HttpError(
      400,
      `force_archive_pending_days must be an integer between 1 and ${MAX_FORCE_ARCHIVE_PENDING_DAYS}.`,
    );
  }

  return { forceArchivePendingDays: Math.trunc(parsedValue) };
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength);
}

function toFiniteNumber(value: number | string): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeForLooseMatch(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantForMatch(row: Pick<TransactionMatchRow, "merchant_canonical" | "merchant_normalized" | "description_short">): string {
  return normalizeForLooseMatch(
    row.merchant_canonical ??
      row.merchant_normalized ??
      row.description_short,
  );
}

function merchantMatchesLoose(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.includes(a)) return true;
  if (b.length >= 5 && a.includes(b)) return true;
  return false;
}

function daysBetweenIso(a: string, b: string): number {
  const aDate = new Date(a);
  const bDate = new Date(b);
  if (Number.isNaN(aDate.getTime()) || Number.isNaN(bDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((aDate.getTime() - bDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function toMatchDate(row: Pick<TransactionMatchRow, "authorized_at" | "posted_at">): string {
  return row.authorized_at ?? row.posted_at;
}

function normalizeMerchantForSearch(input: string): string | null {
  const stopWords =
    /\b(pos|debit|credit|card|purchase|checkcard|visa|mastercard|mc|online|payment|ach|withdrawal|deposit|transfer|txn|pending|posted|inc|llc)\b/g;

  const normalized = input
    .toLowerCase()
    .replace(/[0-9]/g, " ")
    .replace(stopWords, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function normalizeCanonicalMerchant(input: string): string | null {
  const canonical = normalizeMerchantForRecurring(input);
  return canonical === "UNKNOWN" ? null : canonical;
}

function parseAccountsPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> =>
      item !== null
    );
  }

  const payloadObject = asRecord(payload);
  if (!payloadObject) {
    return [];
  }

  const nestedAccounts = payloadObject.accounts;
  if (Array.isArray(nestedAccounts)) {
    return nestedAccounts
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  return [];
}

function parseTransactions(accountObject: Record<string, unknown>): Record<string, unknown>[] {
  const transactions = accountObject.transactions;
  if (!Array.isArray(transactions)) {
    return [];
  }

  return transactions
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

function isCronRequest(req: Request): boolean {
  if (!CRON_SECRET) {
    return false;
  }

  const providedSecret = req.headers.get("x-cron-secret");
  return Boolean(providedSecret && providedSecret === CRON_SECRET);
}

function errorInfo(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "unknown_error",
    stack: null,
  };
}

function getUniqueDecryptSecrets(
  tokenKid: string | null,
): string[] {
  const candidates: string[] = [];
  if (tokenKid && SIMPLEFIN_KEYS_BY_KID[tokenKid]) {
    candidates.push(SIMPLEFIN_KEYS_BY_KID[tokenKid]);
  }
  candidates.push(SIMPLEFIN_ENC_KEY);
  for (const key of Object.values(SIMPLEFIN_KEYS_BY_KID)) {
    candidates.push(key);
  }
  return [...new Set(candidates.filter((value) => typeof value === "string" && value.length > 0))];
}

async function decryptAccessUrl(connection: ConnectionRow): Promise<string> {
  if (!connection.token_enc) {
    throw new Error("No encrypted SimpleFIN token payload available.");
  }

  let payload: { ciphertextB64: string; ivB64: string };
  try {
    const serializedPayload = decodeByteaToString(connection.token_enc);
    payload = parseSerializedEncryptedPayload(serializedPayload);
  } catch {
    throw new Error("Invalid encrypted SimpleFIN token payload.");
  }

  const secrets = getUniqueDecryptSecrets(connection.token_kid);
  let lastError: unknown = null;

  for (const secret of secrets) {
    try {
      const accessUrl = await decryptString(payload, secret);
      return accessUrl;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to decrypt SimpleFIN token payload.");
}

async function getManualUserId(jwt: string): Promise<string> {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await authClient.auth.getUser(jwt);
  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized.");
  }

  return data.user.id;
}

async function getRawDescriptionDaysMap(
  adminClient: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Map<string, UserPreference>> {
  const map = new Map<string, UserPreference>();
  if (userIds.length === 0) {
    return map;
  }

  const { data, error } = await adminClient
    .from("user_preferences")
    .select("user_id, raw_description_days, retention_months")
    .in("user_id", userIds);

  if (error) {
    throw new HttpError(500, "Could not read user preferences.");
  }

  for (const row of data ?? []) {
    const rawDescriptionDays = typeof row.raw_description_days === "number" ? row.raw_description_days : 90;
    const retentionMonths = typeof row.retention_months === "number" ? row.retention_months : 24;
    map.set(row.user_id, { rawDescriptionDays, retentionMonths });
  }

  return map;
}

function toUnixSeconds(input: Date): number {
  return Math.floor(input.getTime() / 1000);
}

function addCalendarDays(input: Date, days: number): Date {
  const copy = new Date(input.toISOString());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function buildBackfillWindows(retentionMonths: number): Array<{ startDate: number; endDate: number }> {
  const now = new Date();
  const start = new Date(now.toISOString());
  start.setUTCMonth(start.getUTCMonth() - retentionMonths);

  const windows: Array<{ startDate: number; endDate: number }> = [];
  let cursor = new Date(start.toISOString());

  while (cursor <= now) {
    const windowStart = new Date(cursor.toISOString());
    const windowEndCandidate = addCalendarDays(windowStart, 59);
    const windowEnd = windowEndCandidate < now ? windowEndCandidate : now;

    windows.push({
      startDate: toUnixSeconds(windowStart),
      endDate: toUnixSeconds(windowEnd),
    });

    cursor = addCalendarDays(windowEnd, 1);
  }

  return windows;
}

async function getTransactionCountForUser(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const { count, error } = await adminClient
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  if (error) {
    throw new HttpError(500, "Could not count transactions.");
  }

  return count ?? 0;
}

async function upsertAccount(
  adminClient: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
): Promise<AccountRow> {
  const { data, error } = await adminClient
    .from("accounts")
    .upsert(row, { onConflict: "user_id,provider_account_id" })
    .select("id")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Could not upsert account.");
  }

  return data as AccountRow;
}

async function upsertTransactions(
  adminClient: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    // Owner inheritance is handled by DB trigger (transactions <- accounts.owner).
    // Strip owner from payload to avoid bypassing manual/account-level ownership rules.
    const batch = rows.slice(i, i + batchSize).map((row) => {
      const { owner: _owner, ...rest } = row;
      return rest;
    });
    const { error } = await adminClient
      .from("transactions")
      .upsert(batch, { onConflict: "account_id,provider_transaction_id" });

    if (error) {
      throw new HttpError(500, "Could not upsert transactions.");
    }
  }
}

async function reconcileStalePendingTransactions(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_PENDING_DAYS);

  const { data: stalePendingRows, error: stalePendingError } = await adminClient
    .from("transactions")
    .select("id, posted_at, authorized_at, amount, merchant_canonical, merchant_normalized, description_short")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_deleted", false)
    .eq("is_pending", true)
    .lte("posted_at", cutoff.toISOString())
    .order("posted_at", { ascending: true })
    .limit(5000);

  if (stalePendingError) {
    throw new HttpError(500, "Could not read stale pending transactions.");
  }

  const candidates = (stalePendingRows ?? []) as TransactionMatchRow[];
  if (candidates.length === 0) return 0;

  let earliest = toMatchDate(candidates[0]);
  for (const candidate of candidates) {
    const candidateDate = toMatchDate(candidate);
    if (candidateDate < earliest) earliest = candidateDate;
  }
  const lookbackStart = new Date(earliest);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 2);

  const { data: postedRows, error: postedRowsError } = await adminClient
    .from("transactions")
    .select("id, posted_at, authorized_at, amount, merchant_canonical, merchant_normalized, description_short")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_deleted", false)
    .eq("is_pending", false)
    .gte("posted_at", lookbackStart.toISOString())
    .order("posted_at", { ascending: true })
    .limit(8000);

  if (postedRowsError) {
    throw new HttpError(500, "Could not read posted transactions for pending reconciliation.");
  }

  const posted = (postedRows ?? []) as TransactionMatchRow[];
  if (posted.length === 0) return 0;

  const matchedPendingIds: string[] = [];
  const usedPostedIds = new Set<string>();

  for (const pending of candidates) {
    const pendingAmount = toFiniteNumber(pending.amount);
    if (pendingAmount === null) continue;

    const pendingMatchDate = toMatchDate(pending);
    const pendingMerchant = merchantForMatch(pending);

    const match = posted.find((postedRow) => {
      if (usedPostedIds.has(postedRow.id)) return false;

      const postedAmount = toFiniteNumber(postedRow.amount);
      if (postedAmount === null) return false;
      if (Math.abs(Math.abs(postedAmount) - Math.abs(pendingAmount)) > AMOUNT_EPSILON) return false;

      const postedMatchDate = toMatchDate(postedRow);
      if (daysBetweenIso(pendingMatchDate, postedMatchDate) > PENDING_MATCH_WINDOW_DAYS) return false;

      const postedMerchant = merchantForMatch(postedRow);
      return merchantMatchesLoose(pendingMerchant, postedMerchant);
    });

    if (!match) continue;
    usedPostedIds.add(match.id);
    matchedPendingIds.push(pending.id);
  }

  if (matchedPendingIds.length === 0) return 0;

  const batchSize = 500;
  for (let i = 0; i < matchedPendingIds.length; i += batchSize) {
    const batch = matchedPendingIds.slice(i, i + batchSize);
    const { error: cleanupError } = await adminClient
      .from("transactions")
      .update({ is_deleted: true })
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("is_deleted", false)
      .eq("is_pending", true)
      .in("id", batch);

    if (cleanupError) {
      throw new HttpError(500, "Could not archive stale pending transactions.");
    }
  }

  return matchedPendingIds.length;
}

async function forceArchivePendingTransactions(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
  olderThanDays: number,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);

  const { data, error } = await adminClient
    .from("transactions")
    .update({ is_deleted: true })
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_deleted", false)
    .eq("is_pending", true)
    .lte("posted_at", cutoff.toISOString())
    .select("id");

  if (error) {
    throw new HttpError(500, "Could not force-archive pending transactions.");
  }

  return (data ?? []).length;
}

async function fetchCategoryRulesV1(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<CategoryRuleV1[]> {
  const { data, error } = await adminClient
    .from("transaction_category_rules_v1")
    .select("id, rule_type, merchant_pattern, account_id, min_amount, max_amount, category_id, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, "Could not load v1 transaction category rules.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    rule_type: row.rule_type,
    merchant_pattern: row.merchant_pattern,
    account_id: row.account_id,
    min_amount: row.min_amount === null ? null : Number(row.min_amount),
    max_amount: row.max_amount === null ? null : Number(row.max_amount),
    category_id: row.category_id,
    is_active: row.is_active === true,
    created_at: row.created_at ?? undefined,
  })) as CategoryRuleV1[];
}

async function fetchOwnerRulesV1(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<OwnerRuleV1[]> {
  const { data, error } = await adminClient
    .from("transaction_owner_rules_v1")
    .select("id, rule_type, merchant_pattern, account_id, min_amount, max_amount, set_owner, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, "Could not load v1 transaction owner rules.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    rule_type: row.rule_type,
    merchant_pattern: row.merchant_pattern,
    account_id: row.account_id,
    min_amount: row.min_amount === null ? null : Number(row.min_amount),
    max_amount: row.max_amount === null ? null : Number(row.max_amount),
    set_owner: row.set_owner,
    is_active: row.is_active === true,
    created_at: row.created_at ?? undefined,
  })) as OwnerRuleV1[];
}

async function getCategoryRulesV1ForUser(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  cache: Map<string, CategoryRuleV1[]>,
): Promise<CategoryRuleV1[]> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const loaded = await fetchCategoryRulesV1(adminClient, userId);
  cache.set(userId, loaded);
  return loaded;
}

async function getOwnerRulesV1ForUser(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  cache: Map<string, OwnerRuleV1[]>,
): Promise<OwnerRuleV1[]> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const loaded = await fetchOwnerRulesV1(adminClient, userId);
  cache.set(userId, loaded);
  return loaded;
}

async function applyCategoryRulesV1AfterImport(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
  importedSnapshots: ImportedTransactionSnapshot[],
  rules: CategoryRuleV1[],
): Promise<number> {
  if (importedSnapshots.length === 0 || rules.length === 0) {
    return 0;
  }

  const snapshotByProviderId = new Map<string, ImportedTransactionSnapshot>();
  for (const snapshot of importedSnapshots) {
    snapshotByProviderId.set(snapshot.providerTransactionId, snapshot);
  }

  const providerIds = [...snapshotByProviderId.keys()];
  const batchSize = 250;
  let updatedCount = 0;

  for (let i = 0; i < providerIds.length; i += batchSize) {
    const providerBatch = providerIds.slice(i, i + batchSize);

    const { data, error } = await adminClient
      .from("transactions")
      .select(
        "id, provider_transaction_id, account_id, amount, owner, merchant_canonical, merchant_normalized, description_short, category_id, user_category_id, category_source, classification_rule_ref, classification_explanation",
      )
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .in("provider_transaction_id", providerBatch);

    if (error) {
      throw new HttpError(500, "Could not load transactions for v1 rule evaluation.");
    }

    for (const row of (data ?? []) as StoredTransactionForRules[]) {
      const imported = snapshotByProviderId.get(row.provider_transaction_id);
      if (!imported) continue;

      const input: TransactionRuleInputV1 = {
        accountId: imported.accountId,
        amount: imported.amount,
        merchantCanonical: imported.merchantCanonical ?? row.merchant_canonical,
        merchantNormalized: imported.merchantNormalized ?? row.merchant_normalized,
        descriptionShort: imported.descriptionShort || row.description_short || "Transaction",
        userCategorySource: row.category_source,
      };

      const result = evaluateRulesV1(input, rules);
      if (result.decision !== "matched_rule") continue;

      const matchedRuleRef = `category_rule_v1:${result.matchedRule.id}`;
      const nextCategoryId = result.matchedRule.category_id;
      const shouldUpdate =
        row.category_id !== nextCategoryId ||
        row.user_category_id !== nextCategoryId ||
        row.category_source !== "rule" ||
        row.classification_rule_ref !== matchedRuleRef ||
        row.classification_explanation !== result.reason;

      if (!shouldUpdate) continue;

      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          category_id: nextCategoryId,
          user_category_id: nextCategoryId,
          category_source: "rule",
          classification_rule_ref: matchedRuleRef,
          classification_explanation: result.reason,
        })
        .eq("id", row.id)
        .eq("user_id", userId)
        .neq("category_source", "user");

      if (updateError) {
        throw new HttpError(500, "Could not apply v1 category rule to imported transactions.");
      }

      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function applyOwnerRulesV1AfterImport(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
  importedSnapshots: ImportedTransactionSnapshot[],
  rules: OwnerRuleV1[],
): Promise<number> {
  if (importedSnapshots.length === 0 || rules.length === 0) {
    return 0;
  }

  const snapshotByProviderId = new Map<string, ImportedTransactionSnapshot>();
  for (const snapshot of importedSnapshots) {
    snapshotByProviderId.set(snapshot.providerTransactionId, snapshot);
  }

  const providerIds = [...snapshotByProviderId.keys()];
  const batchSize = 250;
  let updatedCount = 0;

  for (let i = 0; i < providerIds.length; i += batchSize) {
    const providerBatch = providerIds.slice(i, i + batchSize);

    const { data, error } = await adminClient
      .from("transactions")
      .select(
        "id, provider_transaction_id, account_id, amount, owner, merchant_canonical, merchant_normalized, description_short, category_id, user_category_id, category_source, classification_rule_ref, classification_explanation",
      )
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .in("provider_transaction_id", providerBatch);

    if (error) {
      throw new HttpError(500, "Could not load transactions for owner rule evaluation.");
    }

    for (const row of (data ?? []) as StoredTransactionForRules[]) {
      const imported = snapshotByProviderId.get(row.provider_transaction_id);
      if (!imported) continue;

      const input: TransactionOwnerRuleInputV1 = {
        accountId: imported.accountId,
        amount: imported.amount,
        merchantCanonical: imported.merchantCanonical ?? row.merchant_canonical,
        merchantNormalized: imported.merchantNormalized ?? row.merchant_normalized,
        descriptionShort: imported.descriptionShort || row.description_short || "Transaction",
      };

      const result = evaluateOwnerRulesV1(input, rules);
      if (result.decision !== "matched_rule") continue;

      const nextOwner = result.matchedRule.set_owner as OwnerValueV1;
      if (row.owner === nextOwner) continue;

      const { error: updateError } = await adminClient
        .from("transactions")
        .update({ owner: nextOwner })
        .eq("id", row.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new HttpError(500, "Could not apply v1 owner rule to imported transactions.");
      }

      updatedCount += 1;
    }
  }

  return updatedCount;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: ALLOW_HEADERS,
    allowMethods: ALLOW_METHODS,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let options: SyncRequestOptions = { forceArchivePendingDays: null };
  try {
    options = await parseSyncRequestOptions(req);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Invalid request body." }, 400);
  }

  let scopeUserId: string | null = null;
  let mode: "manual" | "cron" = "manual";

  try {
    if (isCronRequest(req)) {
      mode = "cron";
    } else {
      const jwt = getBearerToken(req);
      if (!jwt) {
        throw new HttpError(401, "Unauthorized.");
      }
      scopeUserId = await getManualUserId(jwt);
    }
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "authorize_request",
      mode,
      user_id: scopeUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Unauthorized." }, 401);
  }

  try {
    const allowForceArchivePending = mode === "cron" && options.forceArchivePendingDays !== null;
    let connectionsQuery = adminClient
      .from("bank_connections")
      .select("id, user_id, token_enc, token_kid")
      .eq("provider", "simplefin")
      .eq("status", "active");

    if (scopeUserId) {
      connectionsQuery = connectionsQuery.eq("user_id", scopeUserId);
    }

    const { data: connections, error: connectionsError } = await connectionsQuery;
    if (connectionsError) {
      throw new HttpError(500, "Could not load bank connections.");
    }

    const safeConnections = (connections ?? []) as ConnectionRow[];
    const uniqueUserIds = [...new Set(safeConnections.map((connection) => connection.user_id))];
    const daysMap = await getRawDescriptionDaysMap(adminClient, uniqueUserIds);
    const userTransactionCountCache = new Map<string, number>();
    const userCategoryRuleCache = new Map<string, CategoryRuleV1[]>();
    const userOwnerRuleCache = new Map<string, OwnerRuleV1[]>();

    let accountsSynced = 0;
    let transactionsSynced = 0;
    let categorizedByRules = 0;
    let ownerAssignedByRules = 0;
    let stalePendingArchived = 0;
    let forcePendingArchived = 0;
    const seenAccountKeys = new Set<string>();
    const seenTransactionKeys = new Set<string>();
    const warnings: string[] = [];

    for (const connection of safeConnections) {
      if (!connection.token_enc) {
        continue;
      }

      const userPreference = daysMap.get(connection.user_id) ?? {
        rawDescriptionDays: 90,
        retentionMonths: 24,
      };
      const rawDescriptionDays = userPreference.rawDescriptionDays;
      let accessUrl = "";
      try {
        accessUrl = await decryptAccessUrl(connection);
      } catch (decryptError) {
        const details = errorInfo(decryptError);
        warnings.push(`Could not decrypt connection ${connection.id}: ${details.message}`);
        console.error(JSON.stringify({
          function: FUNCTION_NAME,
          action: "decrypt_access_url",
          mode,
          user_id: connection.user_id,
          connection_id: connection.id,
          message: details.message,
          stack: details.stack,
        }));
        continue;
      }

      try {
        const payloads: unknown[] = [];
        const pendingCleanupKeys = new Set<string>();
        payloads.push(await fetchAccounts(accessUrl, { pending: true }));

        if (mode === "manual") {
          const cachedCount = userTransactionCountCache.get(connection.user_id);
          const currentTransactionCount = cachedCount ??
            await getTransactionCountForUser(adminClient, connection.user_id);
          userTransactionCountCache.set(connection.user_id, currentTransactionCount);

          // Backfill in 60-day windows for new users or near-empty histories.
          if (currentTransactionCount < 50) {
            const windows = buildBackfillWindows(userPreference.retentionMonths);
            for (const window of windows) {
              try {
                payloads.push(await fetchAccounts(accessUrl, {
                  startDate: window.startDate,
                  endDate: window.endDate,
                  pending: true,
                }));
              } catch (windowError) {
                const details = errorInfo(windowError);
                warnings.push(`Backfill window fetch failed for connection ${connection.id}.`);
                console.error(JSON.stringify({
                  function: FUNCTION_NAME,
                  action: "fetch_accounts_backfill_window",
                  mode,
                  user_id: connection.user_id,
                  connection_id: connection.id,
                  start_date: window.startDate,
                  end_date: window.endDate,
                  message: details.message,
                  stack: details.stack,
                }));
              }
            }
          }
        }

        for (const payload of payloads) {
          const payloadRecord = asRecord(payload);
          const payloadErrors = payloadRecord?.errors;
          if (Array.isArray(payloadErrors)) {
            for (const err of payloadErrors) {
              const errRecord = asRecord(err);
              const message = errRecord ? pickString(errRecord, ["message", "error", "detail"]) : "";
              if (message) {
                warnings.push(message);
              }
            }
          }

          const accounts = parseAccountsPayload(payload);

          for (const accountObject of accounts) {
            const providerAccountId = pickString(accountObject, [
              "id",
              "account_id",
              "accountId",
              "provider_account_id",
            ]);

            if (!providerAccountId) {
              continue;
            }

            const institutionObject = asRecord(accountObject.org) ?? asRecord(accountObject.institution);
            const institutionName = institutionObject ? pickString(institutionObject, ["name"]) : "";
            const accountName = pickString(accountObject, ["name", "display_name"]) || "Account";
            const accountType = pickString(accountObject, ["type", "subtype"]) || "other";
            const accountCurrency = pickString(accountObject, ["currency", "currency_code"]) || "USD";
            const accountBalance = pickNumber(accountObject, ["balance", "current_balance", "currentBalance"]);
            const availableBalance = pickNumber(accountObject, ["available_balance", "availableBalance"]);
            const syncedAt = new Date().toISOString();

            const account = await upsertAccount(adminClient, {
              user_id: connection.user_id,
              provider_account_id: providerAccountId,
              name: accountName,
              institution: institutionName || null,
              type: accountType,
              currency: accountCurrency,
              balance: accountBalance,
              available_balance: availableBalance,
              last_synced_at: syncedAt,
            });

            const accountKey = `${connection.user_id}:${providerAccountId}`;
            if (!seenAccountKeys.has(accountKey)) {
              seenAccountKeys.add(accountKey);
              accountsSynced += 1;
            }

            const transactionRows: Record<string, unknown>[] = [];
            const transactionSnapshots: ImportedTransactionSnapshot[] = [];
            const transactions = parseTransactions(accountObject);

            for (const transactionObject of transactions) {
              const providerTransactionId = pickString(transactionObject, [
                "id",
                "transaction_id",
                "transactionId",
                "provider_transaction_id",
              ]);

              if (!providerTransactionId) {
                continue;
              }

              const rawAmount = pickNumber(transactionObject, ["amount", "value"]);
              if (rawAmount === null) {
                continue;
              }

              const isPending =
                transactionObject.pending === true || transactionObject.is_pending === true ||
                pickString(transactionObject, ["status"]).toLowerCase() === "pending";

              const rawDescription = pickString(transactionObject, [
                "description",
                "raw_description",
                "memo",
                "payee",
                "name",
              ]);

              const descriptionShort = truncate(rawDescription || "Transaction", 256);
              const postedAt = toIsoDate(
                transactionObject.posted_at ?? transactionObject.posted ?? transactionObject.date,
                new Date().toISOString(),
              );
              const authorizedAtRaw = transactionObject.authorized_at ?? transactionObject.authorized;
              const authorizedAt = authorizedAtRaw ? toIsoDate(authorizedAtRaw, postedAt) : null;

              const shouldStoreFull = rawDescriptionDays > 0 && rawDescription.length > 0;
              const descriptionFull = shouldStoreFull ? rawDescription : null;
              const descriptionFullExpiresAt = shouldStoreFull
                ? addDays(postedAt, rawDescriptionDays)
                : null;
              const merchantCanonical = normalizeCanonicalMerchant(rawDescription || descriptionShort);
              const merchantNormalized = normalizeMerchantForSearch(rawDescription);

              const transactionKey = `${account.id}:${providerTransactionId}`;
              if (!seenTransactionKeys.has(transactionKey)) {
                seenTransactionKeys.add(transactionKey);
                transactionsSynced += 1;
              }

              transactionRows.push({
                user_id: connection.user_id,
                account_id: account.id,
                provider_transaction_id: providerTransactionId,
                amount: rawAmount,
                currency: pickString(transactionObject, ["currency", "currency_code"]) || accountCurrency,
                posted_at: postedAt,
                authorized_at: authorizedAt,
                is_pending: isPending,
                description_short: descriptionShort,
                description_full: descriptionFull,
                description_full_expires_at: descriptionFullExpiresAt,
                merchant_normalized: merchantNormalized,
                merchant_canonical: merchantCanonical,
                is_deleted: transactionObject.is_deleted === true || transactionObject.deleted === true,
              });

              transactionSnapshots.push({
                accountId: account.id,
                providerTransactionId,
                amount: rawAmount,
                merchantCanonical,
                merchantNormalized,
                descriptionShort,
              });
            }

            await upsertTransactions(adminClient, transactionRows);

            if (transactionSnapshots.length > 0) {
              const categoryRules = await getCategoryRulesV1ForUser(
                adminClient,
                connection.user_id,
                userCategoryRuleCache,
              );
              const ownerRules = await getOwnerRulesV1ForUser(
                adminClient,
                connection.user_id,
                userOwnerRuleCache,
              );
              categorizedByRules += await applyCategoryRulesV1AfterImport(
                adminClient,
                connection.user_id,
                account.id,
                transactionSnapshots,
                categoryRules,
              );
              ownerAssignedByRules += await applyOwnerRulesV1AfterImport(
                adminClient,
                connection.user_id,
                account.id,
                transactionSnapshots,
                ownerRules,
              );
            }

            const cleanupKey = `${connection.user_id}:${account.id}`;
            if (!pendingCleanupKeys.has(cleanupKey)) {
              pendingCleanupKeys.add(cleanupKey);
              stalePendingArchived += await reconcileStalePendingTransactions(adminClient, connection.user_id, account.id);
              if (allowForceArchivePending) {
                forcePendingArchived += await forceArchivePendingTransactions(
                  adminClient,
                  connection.user_id,
                  account.id,
                  options.forceArchivePendingDays as number,
                );
              }
            }
          }
        }
      } catch (connectionSyncError) {
        const details = errorInfo(connectionSyncError);
        warnings.push(`Connection ${connection.id} sync failed.`);
        console.error(JSON.stringify({
          function: FUNCTION_NAME,
          action: "sync_connection",
          mode,
          user_id: connection.user_id,
          connection_id: connection.id,
          message: details.message,
          stack: details.stack,
        }));
      }
    }

    return json(req, {
      ok: true,
      mode,
      users: uniqueUserIds.length,
      connections: safeConnections.length,
      accountsSynced,
      transactionsSynced,
      categorizedByRules,
      ownerAssignedByRules,
      stalePendingArchived,
      forcePendingArchived,
      forceArchivePendingDays: allowForceArchivePending ? options.forceArchivePendingDays : null,
      warnings,
    });
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "sync_flow",
      mode,
      user_id: scopeUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Sync failed." }, 500);
  }
});
