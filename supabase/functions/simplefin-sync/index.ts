import { createClient } from "@supabase/supabase-js";
import { decryptString } from "../_shared/crypto.ts";
import { fetchAccounts } from "../_shared/simplefin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SIMPLEFIN_ENC_KEY = Deno.env.get("SIMPLEFIN_ENC_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment configuration.");
}

if (!SIMPLEFIN_ENC_KEY) {
  throw new Error("Missing SIMPLEFIN_ENC_KEY.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  access_url_ciphertext: string | null;
  access_url_iv: string | null;
};

type AccountRow = {
  id: string;
};

type UserPreference = {
  rawDescriptionDays: number;
  retentionMonths: number;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
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
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.valueOf())) {
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

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength);
}

function normalizeMerchant(input: string): string | null {
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
  const header = req.headers.get("Authorization") ?? "";
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

async function getManualUserId(jwt: string): Promise<string> {
  const authClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
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
    const batch = rows.slice(i, i + batchSize);
    const { error } = await adminClient
      .from("transactions")
      .upsert(batch, { onConflict: "account_id,provider_transaction_id" });

    if (error) {
      throw new HttpError(500, "Could not upsert transactions.");
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

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
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    let connectionsQuery = adminClient
      .from("bank_connections")
      .select("id, user_id, access_url_ciphertext, access_url_iv")
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

    let accountsSynced = 0;
    let transactionsSynced = 0;
    const seenAccountKeys = new Set<string>();
    const seenTransactionKeys = new Set<string>();
    const warnings: string[] = [];

    for (const connection of safeConnections) {
      if (!connection.access_url_ciphertext || !connection.access_url_iv) {
        continue;
      }

      const userPreference = daysMap.get(connection.user_id) ?? {
        rawDescriptionDays: 90,
        retentionMonths: 24,
      };
      const rawDescriptionDays = userPreference.rawDescriptionDays;
      const accessUrl = await decryptString({
        ciphertextB64: connection.access_url_ciphertext,
        ivB64: connection.access_url_iv,
      }, SIMPLEFIN_ENC_KEY!);

      const payloads: unknown[] = [];
      payloads.push(await fetchAccounts(accessUrl, { pending: true }));

      if (mode === "manual") {
        const cachedCount = userTransactionCountCache.get(connection.user_id);
        const currentTransactionCount = cachedCount ?? await getTransactionCountForUser(adminClient, connection.user_id);
        userTransactionCountCache.set(connection.user_id, currentTransactionCount);

        // Backfill in 60-day windows for new users or near-empty histories.
        if (currentTransactionCount < 50) {
          const windows = buildBackfillWindows(userPreference.retentionMonths);
          for (const window of windows) {
            payloads.push(await fetchAccounts(accessUrl, {
              startDate: window.startDate,
              endDate: window.endDate,
              pending: true,
            }));
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
              merchant_normalized: normalizeMerchant(rawDescription),
              is_deleted: transactionObject.is_deleted === true || transactionObject.deleted === true,
            });
          }

          await upsertTransactions(adminClient, transactionRows);
        }
      }
    }

    return json({
      ok: true,
      mode,
      users: uniqueUserIds.length,
      connections: safeConnections.length,
      accountsSynced,
      transactionsSynced,
      warnings,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: "Sync failed." }, 500);
  }
});
