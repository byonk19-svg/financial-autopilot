import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSupabaseConfig, requireEnv } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/hash.ts";
import {
  classifyRecurring,
  compileMerchantAliases,
  findMerchantAlias,
  normalizeMerchantForRecurring,
  type MerchantAliasMatcher,
  type MerchantAliasRow,
  type RecurringKind,
} from "../_shared/merchant.ts";
import { detectRecurringPattern, type Cadence, type RecurringCharge } from "../_shared/recurring.ts";

const { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseConfig();
const CRON_SECRET = requireEnv("CRON_SECRET");

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-cron-secret";
const ALLOW_METHODS = "POST, OPTIONS";
const FUNCTION_NAME = "analysis-daily";

const LOOKBACK_90_DAYS = 90;
const LOOKBACK_180_DAYS = 180;
const LOOKBACK_730_DAYS = 730;
const METRICS_WINDOW_DAYS = 30;
const ESSENTIAL_KEYWORDS = [
  "rent",
  "mortgage",
  "utility",
  "utilities",
  "electric",
  "gas",
  "water",
  "insurance",
  "loan",
  "debt",
  "internet",
  "phone",
  "medical",
  "health",
  "tax",
  "tuition",
];

type TxRow = {
  id: string;
  account_id: string;
  posted_at: string;
  amount: number | string;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  description_short: string;
  category_id: string | null;
  user_category_id: string | null;
};

type MetricsRow = {
  user_id: string;
  day: string;
  spend_total: number;
  spend_weekend: number;
  spend_weekday: number;
  spend_after_20: number;
  spend_after_22: number;
  small_purchases_10_30: number;
  discretionary_spend: number;
};

type SubscriptionCandidate = {
  user_id: string;
  merchant_normalized: string;
  cadence: Cadence;
  confidence: number;
  classification: SubscriptionClassification;
  classification_rule_ref: string | null;
  classification_explanation: string | null;
  kind: RecurringKind;
  is_subscription: boolean;
  last_amount: number | null;
  prev_amount: number | null;
  last_charge_at: string | null;
  next_expected_at: string | null;
  occurrences: number;
};

type SubscriptionClassification = "needs_review" | "subscription" | "bill_loan" | "transfer" | "ignore";

type RecurringClassificationRuleRow = {
  id: string;
  merchant_normalized: string;
  cadence: Cadence | null;
  min_amount: number | string | null;
  max_amount: number | string | null;
  classification: SubscriptionClassification;
  created_at: string;
};

type TransactionRuleRow = {
  id: string;
  name: string;
  match_type: "contains" | "equals" | "regex";
  pattern: string;
  account_id: string | null;
  cadence: Cadence | null;
  min_amount: number | string | null;
  max_amount: number | string | null;
  target_amount: number | string | null;
  amount_tolerance_pct: number | string | null;
  set_merchant_normalized: string | null;
  set_pattern_classification: SubscriptionClassification | null;
  set_spending_category_id: string | null;
  explanation: string | null;
  priority: number;
  created_at: string;
};

type EnrichedTxRow = TxRow & {
  effective_merchant: string;
  forced_pattern_classification: SubscriptionClassification | null;
  forced_pattern_cadence: Cadence | null;
  applied_rule_ref: string | null;
  applied_rule_explanation: string | null;
  applied_rule_priority: number | null;
  kind_hint: string | null;
  rule_forced_category_id: string | null;
  rule_forced_merchant: boolean;
};

type AlertInsert = {
  user_id: string;
  alert_type: "unusual_charge" | "duplicate_charge" | "subscription_increase" | "pace_warning" | "bill_spike";
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  fingerprint: string;
  merchant_normalized: string | null;
  amount: number | null;
  metadata: Record<string, unknown>;
  reasoning: Record<string, unknown> | null;
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

function isCronAuthorized(req: Request): boolean {
  const provided = req.headers.get("x-cron-secret");
  return Boolean(provided && provided === CRON_SECRET);
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function resolveManualUserId(
  admin: ReturnType<typeof createClient>,
  req: Request,
): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function expenseAmount(value: number | string): number {
  const parsed = toNumber(value);
  return parsed < 0 ? Math.abs(parsed) : 0;
}

function dateDaysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function toUtcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function parseDayKey(day: string): Date {
  const [year, month, date] = day.split("-").map((token) => Number.parseInt(token, 10));
  return new Date(Date.UTC(year, month - 1, date));
}

function addDays(day: string, days: number): string {
  const base = parseDayKey(day);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = parseDayKey(b).getTime() - parseDayKey(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function normalizeMatchInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesRulePattern(matchType: TransactionRuleRow["match_type"], pattern: string, haystack: string): boolean {
  const normalizedPattern = normalizeMatchInput(pattern);
  if (!normalizedPattern) return false;

  if (matchType === "equals") {
    return haystack === normalizedPattern;
  }

  if (matchType === "regex") {
    try {
      const regex = new RegExp(pattern, "i");
      return regex.test(haystack);
    } catch (error) {
      const details = errorInfo(error);
      console.error(JSON.stringify({
        function: FUNCTION_NAME,
        action: "compile_regex_rule",
        message: details.message,
        stack: details.stack,
      }));
      return false;
    }
  }

  return haystack.includes(normalizedPattern);
}

function isEssentialLabel(label: string): boolean {
  const value = label.toLowerCase();
  return ESSENTIAL_KEYWORDS.some((keyword) => value.includes(keyword));
}

function isDiscretionary(tx: TxRow, categoryNames: Map<string, string>): boolean {
  const categoryId = tx.user_category_id ?? tx.category_id;
  if (categoryId && categoryNames.has(categoryId)) {
    return !isEssentialLabel(categoryNames.get(categoryId)!);
  }

  const merchant = tx.merchant_canonical ?? tx.merchant_normalized ?? "";
  if (merchant) {
    return !isEssentialLabel(merchant);
  }

  return true;
}

function monthKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthInfoNow(): {
  currentMonthKey: string;
  previousMonthKey: string;
  daysElapsed: number;
  daysInMonth: number;
} {
  const now = new Date();
  const currentMonthKey = monthKeyFromDate(now);
  const daysElapsed = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonthKey = monthKeyFromDate(prev);
  return { currentMonthKey, previousMonthKey, daysElapsed, daysInMonth };
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function feedbackMerchantKey(merchant: string | null): string {
  const normalized = (merchant ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "__unscoped__";
}

async function listUserIdsWithAccounts(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await admin.from("accounts").select("user_id");
  if (error) throw new Error("Could not resolve users with accounts.");
  return [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))];
}

async function fetchTransactions(
  admin: ReturnType<typeof createClient>,
  userId: string,
  since: Date,
): Promise<TxRow[]> {
  const { data, error } = await admin
    .from("transactions")
    .select(
      "id, account_id, posted_at, amount, merchant_canonical, merchant_normalized, description_short, category_id, user_category_id",
    )
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .gte("posted_at", since.toISOString())
    .order("posted_at", { ascending: true });

  if (error) throw new Error("Could not read transactions.");
  return (data ?? []) as TxRow[];
}

async function fetchCategoryNames(
  admin: ReturnType<typeof createClient>,
  userId: string,
  txRows: TxRow[],
): Promise<Map<string, string>> {
  const ids = [...new Set(txRows.flatMap((row) => [row.user_category_id, row.category_id]).filter(Boolean))];
  if (ids.length === 0) return new Map<string, string>();

  const { data, error } = await admin
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", ids as string[]);

  if (error) throw new Error("Could not read categories.");

  const names = new Map<string, string>();
  for (const row of data ?? []) {
    names.set(row.id, row.name);
  }
  return names;
}

function buildMetricsRows(userId: string, tx90: TxRow[], categoryNames: Map<string, string>): MetricsRow[] {
  // UTC is used as the day/hour basis for deterministic server-side aggregation.
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(today, -(METRICS_WINDOW_DAYS - 1));
  const rows = new Map<string, MetricsRow>();

  let cursor = start;
  for (let i = 0; i < METRICS_WINDOW_DAYS; i += 1) {
    rows.set(cursor, {
      user_id: userId,
      day: cursor,
      spend_total: 0,
      spend_weekend: 0,
      spend_weekday: 0,
      spend_after_20: 0,
      spend_after_22: 0,
      small_purchases_10_30: 0,
      discretionary_spend: 0,
    });
    cursor = addDays(cursor, 1);
  }

  for (const tx of tx90) {
    const spend = expenseAmount(tx.amount);
    if (spend <= 0) continue;
    const day = toUtcDayKey(tx.posted_at);
    const row = rows.get(day);
    if (!row) continue;

    const date = new Date(tx.posted_at);
    if (Number.isNaN(date.valueOf())) continue;
    const dow = date.getUTCDay();
    const hour = date.getUTCHours();

    row.spend_total += spend;
    if (dow === 0 || dow === 6) {
      row.spend_weekend += spend;
    } else {
      row.spend_weekday += spend;
    }

    if (hour >= 20) row.spend_after_20 += spend;
    if (hour >= 22) row.spend_after_22 += spend;
    if (spend >= 10 && spend <= 30) row.small_purchases_10_30 += spend;
    if (isDiscretionary(tx, categoryNames)) row.discretionary_spend += spend;
  }

  return [...rows.values()].map((row) => ({
    ...row,
    spend_total: round2(row.spend_total),
    spend_weekend: round2(row.spend_weekend),
    spend_weekday: round2(row.spend_weekday),
    spend_after_20: round2(row.spend_after_20),
    spend_after_22: round2(row.spend_after_22),
    small_purchases_10_30: round2(row.small_purchases_10_30),
    discretionary_spend: round2(row.discretionary_spend),
  }));
}

function addCadenceInterval(day: string, cadence: Exclude<Cadence, "unknown">): string {
  const base = parseDayKey(day);
  if (cadence === "weekly") {
    base.setUTCDate(base.getUTCDate() + 7);
  } else if (cadence === "monthly") {
    base.setUTCMonth(base.getUTCMonth() + 1);
  } else if (cadence === "quarterly") {
    base.setUTCMonth(base.getUTCMonth() + 3);
  } else if (cadence === "yearly") {
    base.setUTCFullYear(base.getUTCFullYear() + 1);
  }
  return base.toISOString().slice(0, 10);
}

function toRecurringCharge(tx: TxRow): RecurringCharge | null {
  const amount = expenseAmount(tx.amount);
  if (amount <= 0) return null;
  return { day: toUtcDayKey(tx.posted_at), absAmount: amount };
}

type GroupedRecurring = {
  charges: RecurringCharge[];
  kindHint: string | null;
  forcedDecisions: Array<{
    classification: SubscriptionClassification;
    cadence: Cadence | null;
    ruleRef: string | null;
    explanation: string | null;
    priority: number;
  }>;
};

function normalizeKindHint(kindHint: string | null): RecurringKind | null {
  if (!kindHint) return null;
  const normalized = kindHint.trim().toLowerCase();
  if (
    normalized === "recurring" ||
    normalized === "subscription" ||
    normalized === "bill" ||
    normalized === "loan" ||
    normalized === "transfer" ||
    normalized === "payroll" ||
    normalized === "discretionary_recurring"
  ) {
    return normalized;
  }
  return null;
}

async function fetchTransactionRules(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<TransactionRuleRow[]> {
  const { data, error } = await admin
    .from("transaction_rules")
    .select(
      "id, name, match_type, pattern, account_id, cadence, min_amount, max_amount, target_amount, amount_tolerance_pct, set_merchant_normalized, set_pattern_classification, set_spending_category_id, explanation, priority, created_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Could not load transaction rules.");
  }

  return (data ?? []) as TransactionRuleRow[];
}

function matchTransactionRule(tx: TxRow, rules: TransactionRuleRow[]): TransactionRuleRow | null {
  const absAmount = Math.abs(toNumber(tx.amount));
  const haystack = normalizeMatchInput(
    `${tx.merchant_canonical ?? ""} ${tx.merchant_normalized ?? ""} ${tx.description_short}`,
  );

  for (const rule of rules) {
    if (rule.account_id && rule.account_id !== tx.account_id) continue;

    if (rule.min_amount !== null && absAmount < toNumber(rule.min_amount)) continue;
    if (rule.max_amount !== null && absAmount > toNumber(rule.max_amount)) continue;

    if (rule.target_amount !== null && rule.amount_tolerance_pct !== null) {
      const target = toNumber(rule.target_amount);
      const pct = clamp(toNumber(rule.amount_tolerance_pct), 0, 1);
      const lower = target * (1 - pct);
      const upper = target * (1 + pct);
      if (absAmount < lower || absAmount > upper) continue;
    }

    if (!matchesRulePattern(rule.match_type, rule.pattern, haystack)) continue;

    return rule;
  }

  return null;
}

function applyRulesToTransactions(
  txRows: TxRow[],
  aliases: MerchantAliasMatcher[],
  rules: TransactionRuleRow[],
): EnrichedTxRow[] {
  const enriched: EnrichedTxRow[] = [];

  for (const tx of txRows) {
    const alias = findMerchantAlias(
      [tx.merchant_canonical, tx.merchant_normalized, tx.description_short],
      aliases,
      tx.account_id,
    );
    const matchedRule = matchTransactionRule(tx, rules);

    const baseMerchant = matchedRule?.set_merchant_normalized?.trim() ||
      alias?.normalized ||
      tx.merchant_canonical ||
      tx.merchant_normalized ||
      tx.description_short;
    const effectiveMerchant = normalizeMerchantForRecurring(baseMerchant);

    const aliasRef = alias ? `merchant_alias:${alias.id}` : null;
    const aliasExplanation = alias ? `Matched merchant alias pattern "${alias.pattern}".` : null;
    const ruleRef = matchedRule ? `transaction_rule:${matchedRule.id}` : aliasRef;
    const ruleExplanation = matchedRule
      ? matchedRule.explanation?.trim() || `Matched transaction rule "${matchedRule.name}".`
      : aliasExplanation;

    enriched.push({
      ...tx,
      merchant_canonical: tx.merchant_canonical ?? null,
      merchant_normalized: tx.merchant_normalized ?? null,
      user_category_id: matchedRule?.set_spending_category_id ?? tx.user_category_id,
      effective_merchant: effectiveMerchant,
      forced_pattern_classification: matchedRule?.set_pattern_classification ?? null,
      forced_pattern_cadence: matchedRule?.cadence ?? null,
      applied_rule_ref: ruleRef,
      applied_rule_explanation: ruleExplanation,
      applied_rule_priority: matchedRule?.priority ?? null,
      kind_hint: alias?.kind_hint ?? null,
      rule_forced_category_id: matchedRule?.set_spending_category_id ?? null,
      rule_forced_merchant: Boolean(matchedRule?.set_merchant_normalized?.trim() || alias?.normalized),
    });
  }

  return enriched;
}

async function persistTransactionRuleMatches(
  admin: ReturnType<typeof createClient>,
  userId: string,
  txRows: EnrichedTxRow[],
): Promise<void> {
  const matchedRows = txRows.filter((row) => row.applied_rule_ref !== null);
  if (matchedRows.length === 0) return;

  for (const row of matchedRows) {
    const updatePayload: {
      classification_rule_ref: string | null;
      classification_explanation: string | null;
      user_category_id?: string | null;
      merchant_canonical?: string | null;
      merchant_normalized?: string | null;
    } = {
      classification_rule_ref: row.applied_rule_ref,
      classification_explanation: row.applied_rule_explanation,
    };

    if (row.rule_forced_category_id) {
      updatePayload.user_category_id = row.rule_forced_category_id;
    }

    if (row.rule_forced_merchant && row.effective_merchant && row.effective_merchant !== "UNKNOWN") {
      updatePayload.merchant_canonical = row.effective_merchant;
      updatePayload.merchant_normalized = row.effective_merchant;
    }

    const { error } = await admin
      .from("transactions")
      .update(updatePayload)
      .eq("id", row.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error("Could not persist transaction rule attribution.");
    }
  }
}

function toSubscriptionClassification(kind: RecurringKind, confidence: number): SubscriptionClassification {
  if (confidence < 0.8) return "needs_review";
  if (kind === "transfer") return "transfer";
  if (kind === "bill" || kind === "loan") return "bill_loan";
  if (kind === "payroll") return "ignore";
  if (kind === "subscription") return "subscription";
  return "needs_review";
}

async function fetchMerchantAliasMatchers(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<MerchantAliasMatcher[]> {
  const [userAliasesResult, globalAliasesResult] = await Promise.all([
    admin
      .from("merchant_aliases")
      .select("id, user_id, account_id, match_type, pattern, normalized, kind_hint, priority")
      .eq("is_active", true)
      .eq("user_id", userId)
      .order("priority", { ascending: true })
      .order("id", { ascending: true }),
    admin
      .from("merchant_aliases")
      .select("id, user_id, account_id, match_type, pattern, normalized, kind_hint, priority")
      .eq("is_active", true)
      .is("user_id", null)
      .order("priority", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (userAliasesResult.error || globalAliasesResult.error) {
    // Keep analysis running even if alias table is unavailable.
    console.log(JSON.stringify({ warning: "merchant_aliases_unavailable", user_id: userId }));
    return [];
  }

  const aliases = [
    ...(userAliasesResult.data ?? []),
    ...(globalAliasesResult.data ?? []),
  ] as MerchantAliasRow[];

  return compileMerchantAliases(aliases);
}

function groupRecurringByMerchant(transactions: EnrichedTxRow[]): Map<string, GroupedRecurring> {
  const grouped = new Map<string, GroupedRecurring>();

  for (const tx of transactions) {
    const charge = toRecurringCharge(tx);
    if (!charge) continue;
    const merchantKey = tx.effective_merchant;
    if (!merchantKey || merchantKey === "UNKNOWN") continue;

    const group = grouped.get(merchantKey) ?? { charges: [], kindHint: null, forcedDecisions: [] };
    group.charges.push(charge);
    if (!group.kindHint && tx.kind_hint) {
      group.kindHint = tx.kind_hint;
    }
    if (tx.forced_pattern_classification) {
      group.forcedDecisions.push({
        classification: tx.forced_pattern_classification,
        cadence: tx.forced_pattern_cadence,
        ruleRef: tx.applied_rule_ref,
        explanation: tx.applied_rule_explanation,
        priority: tx.applied_rule_priority ?? 10_000,
      });
    }
    grouped.set(merchantKey, group);
  }

  return grouped;
}

function selectForcedDecisionForCadence(
  group: GroupedRecurring,
  cadence: Cadence | null,
): {
  classification: SubscriptionClassification;
  ruleRef: string | null;
  explanation: string | null;
} | null {
  const eligible = group.forcedDecisions.filter((decision) => decision.cadence === null || decision.cadence === cadence);
  if (eligible.length === 0) return null;

  const counts = new Map<
    string,
    {
      classification: SubscriptionClassification;
      ruleRef: string | null;
      explanation: string | null;
      priority: number;
      count: number;
    }
  >();

  for (const decision of eligible) {
    const key = `${decision.ruleRef ?? "none"}:${decision.classification}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      existing.priority = Math.min(existing.priority, decision.priority);
      counts.set(key, existing);
      continue;
    }
    counts.set(key, {
      classification: decision.classification,
      ruleRef: decision.ruleRef,
      explanation: decision.explanation,
      priority: decision.priority,
      count: 1,
    });
  }

  const ranked = [...counts.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.count !== b.count) return b.count - a.count;
    return (a.ruleRef ?? "").localeCompare(b.ruleRef ?? "");
  });

  const winner = ranked[0];
  return {
    classification: winner.classification,
    ruleRef: winner.ruleRef,
    explanation: winner.explanation,
  };
}

function buildCandidateFromDetection(
  userId: string,
  merchantKey: string,
  group: GroupedRecurring,
  detection: ReturnType<typeof detectRecurringPattern>,
): SubscriptionCandidate | null {
  if (!detection) return null;
  if (detection.cadence === "unknown") return null;
  if (detection.filteredCharges.length < 2) return null;

  const ordered = [...detection.filteredCharges].sort((a, b) => (a.day < b.day ? -1 : 1));
  const last = ordered[ordered.length - 1];
  const prev = ordered.length >= 2 ? ordered[ordered.length - 2] : null;
  const classification = classifyRecurring(merchantKey);
  const normalizedHint = normalizeKindHint(group.kindHint);
  const effectiveKind = normalizedHint ?? classification.kind;
  const isSubscription = effectiveKind === "subscription";
  const confidence = round2(clamp(detection.confidence, 0, 1));
  const forcedDecision = selectForcedDecisionForCadence(group, detection.cadence);
  const recurringClassification = forcedDecision?.classification ?? toSubscriptionClassification(effectiveKind, confidence);
  const heuristicExplanation =
    `Auto-classified from recurring ${detection.cadence} pattern (confidence ${confidence.toFixed(2)}, kind ${effectiveKind}).`;

  return {
    user_id: userId,
    merchant_normalized: merchantKey,
    cadence: detection.cadence,
    confidence,
    classification: recurringClassification,
    classification_rule_ref: forcedDecision?.ruleRef ?? "heuristic:recurring-pattern",
    classification_explanation: forcedDecision?.explanation ?? heuristicExplanation,
    kind: effectiveKind,
    is_subscription: isSubscription,
    last_amount: round2(last.absAmount),
    prev_amount: prev ? round2(prev.absAmount) : null,
    last_charge_at: last.day,
    next_expected_at: addCadenceInterval(last.day, detection.cadence),
    occurrences: detection.occurrences,
  };
}

function buildSubscriptionCandidates(
  userId: string,
  tx180: EnrichedTxRow[],
  tx730: EnrichedTxRow[],
): SubscriptionCandidate[] {
  const candidates: SubscriptionCandidate[] = [];
  const seen = new Set<string>();

  const grouped180 = groupRecurringByMerchant(tx180);
  for (const [merchantKey, group] of grouped180.entries()) {
    const detection = detectRecurringPattern(group.charges, ["weekly", "monthly", "quarterly"]);
    const candidate = buildCandidateFromDetection(userId, merchantKey, group, detection);
    if (!candidate) continue;
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  const grouped730 = groupRecurringByMerchant(tx730);
  for (const [merchantKey, group] of grouped730.entries()) {
    const detection = detectRecurringPattern(group.charges, ["yearly"]);
    const candidate = buildCandidateFromDetection(userId, merchantKey, group, detection);
    if (!candidate) continue;
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  return candidates;
}

function parsePriceHistory(input: unknown): Array<{ amount: number; charged_at: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const amount = typeof row.amount === "number"
        ? row.amount
        : typeof row.amount === "string"
        ? Number.parseFloat(row.amount)
        : NaN;
      const chargedAt = typeof row.charged_at === "string" ? row.charged_at : "";
      if (!Number.isFinite(amount) || !chargedAt) return null;
      return { amount: round2(amount), charged_at: chargedAt };
    })
    .filter((value): value is { amount: number; charged_at: string } => value !== null);
}

function upsertPriceHistory(
  current: Array<{ amount: number; charged_at: string }>,
  amount: number | null,
  chargedAt: string | null,
): Array<{ amount: number; charged_at: string }> {
  if (amount === null || !chargedAt) return current.slice(-12);
  const last = current[current.length - 1];
  if (!last || Math.abs(last.amount - amount) > 0.009) {
    return [...current, { amount: round2(amount), charged_at: chargedAt }].slice(-12);
  }
  return current.slice(-12);
}

function rangeWidth(rule: RecurringClassificationRuleRow): number {
  const min = rule.min_amount === null ? null : toNumber(rule.min_amount);
  const max = rule.max_amount === null ? null : toNumber(rule.max_amount);
  if (min === null || max === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, max - min);
}

function ruleSpecificity(rule: RecurringClassificationRuleRow): number {
  let score = 0;
  if (rule.cadence !== null) score += 4;
  if (rule.min_amount !== null) score += 2;
  if (rule.max_amount !== null) score += 2;
  return score;
}

function ruleMatchesCandidate(rule: RecurringClassificationRuleRow, candidate: SubscriptionCandidate): boolean {
  if (rule.merchant_normalized !== candidate.merchant_normalized) return false;
  if (rule.cadence !== null && rule.cadence !== candidate.cadence) return false;

  const amount = candidate.last_amount;
  if (rule.min_amount !== null) {
    if (amount === null) return false;
    if (amount < toNumber(rule.min_amount)) return false;
  }

  if (rule.max_amount !== null) {
    if (amount === null) return false;
    if (amount > toNumber(rule.max_amount)) return false;
  }

  return true;
}

function selectRule(
  rules: RecurringClassificationRuleRow[],
  candidate: SubscriptionCandidate,
): RecurringClassificationRuleRow | null {
  const matches = rules.filter((rule) => ruleMatchesCandidate(rule, candidate));
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const scoreDiff = ruleSpecificity(b) - ruleSpecificity(a);
    if (scoreDiff !== 0) return scoreDiff;

    const widthDiff = rangeWidth(a) - rangeWidth(b);
    if (widthDiff !== 0) return widthDiff;

    // More recently created rules win for same specificity/range.
    if (a.created_at > b.created_at) return -1;
    if (a.created_at < b.created_at) return 1;
    return 0;
  });

  return matches[0];
}

async function upsertSubscriptions(
  admin: ReturnType<typeof createClient>,
  userId: string,
  candidates: SubscriptionCandidate[],
): Promise<number> {
  if (candidates.length === 0) return 0;

  const merchants = [...new Set(candidates.map((candidate) => candidate.merchant_normalized))];
  const { data: existingRows } = await admin
    .from("subscriptions")
    .select(
      "merchant_normalized, cadence, price_history, classification, user_locked, classification_rule_ref, classification_explanation, is_false_positive",
    )
    .eq("user_id", userId)
    .in("merchant_normalized", merchants);

  const existingMap = new Map<
    string,
    {
      priceHistory: Array<{ amount: number; charged_at: string }>;
      classification: SubscriptionClassification;
      userLocked: boolean;
      isFalsePositive: boolean;
      classificationRuleRef: string | null;
      classificationExplanation: string | null;
    }
  >();
  for (const row of existingRows ?? []) {
    const key = `${row.merchant_normalized}:${row.cadence}`;
    const classification = row.classification as SubscriptionClassification | null;
    existingMap.set(key, {
      priceHistory: parsePriceHistory(row.price_history),
      classification: classification ?? "needs_review",
      userLocked: row.user_locked === true,
      isFalsePositive: row.is_false_positive === true,
      classificationRuleRef: typeof row.classification_rule_ref === "string" ? row.classification_rule_ref : null,
      classificationExplanation: typeof row.classification_explanation === "string"
        ? row.classification_explanation
        : null,
    });
  }

  const { data: ruleRows, error: ruleError } = await admin
    .from("recurring_classification_rules")
    .select("id, merchant_normalized, cadence, min_amount, max_amount, classification, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("merchant_normalized", merchants)
    .order("created_at", { ascending: false });

  if (ruleError) throw new Error("Could not read recurring classification rules.");

  const rulesByMerchant = new Map<string, RecurringClassificationRuleRow[]>();
  for (const row of (ruleRows ?? []) as RecurringClassificationRuleRow[]) {
    const list = rulesByMerchant.get(row.merchant_normalized) ?? [];
    list.push(row);
    rulesByMerchant.set(row.merchant_normalized, list);
  }

  const payload = candidates.flatMap((candidate) => {
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    const existing = existingMap.get(key);
    if (existing?.isFalsePositive) {
      return [];
    }
    const existingHistory = existing?.priceHistory ?? [];
    const priceHistory = upsertPriceHistory(existingHistory, candidate.last_amount, candidate.last_charge_at);
    const matchingRules = rulesByMerchant.get(candidate.merchant_normalized) ?? [];
    const ruleMatch = selectRule(matchingRules, candidate);
    const nextClassification = ruleMatch?.classification ?? candidate.classification;

    const classification = existing?.userLocked ? existing.classification : nextClassification;
    const classificationRuleRef = existing?.userLocked
      ? existing.classificationRuleRef
      : ruleMatch
      ? `recurring_rule:${ruleMatch.id}`
      : candidate.classification_rule_ref;
    const classificationExplanation = existing?.userLocked
      ? existing.classificationExplanation
      : ruleMatch
      ? `Matched recurring classification rule ${ruleMatch.id} for ${candidate.merchant_normalized}.`
      : candidate.classification_explanation;

    return [{
      ...candidate,
      classification,
      classification_rule_ref: classificationRuleRef,
      classification_explanation: classificationExplanation,
      price_history: priceHistory,
      is_active: true,
      is_subscription: classification === "subscription",
    }];
  });

  const { error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id,merchant_normalized,cadence" });

  if (error) throw new Error("Could not upsert subscriptions.");
  return payload.length;
}

async function filterFalsePositiveCandidates(
  admin: ReturnType<typeof createClient>,
  userId: string,
  candidates: SubscriptionCandidate[],
): Promise<SubscriptionCandidate[]> {
  if (candidates.length === 0) return [];

  const merchants = [...new Set(candidates.map((candidate) => candidate.merchant_normalized))];
  const { data, error } = await admin
    .from("subscriptions")
    .select("merchant_normalized, cadence")
    .eq("user_id", userId)
    .eq("is_false_positive", true)
    .in("merchant_normalized", merchants);

  if (error) {
    throw new Error("Could not read false-positive subscriptions.");
  }

  const falsePositiveKeys = new Set<string>();
  for (const row of data ?? []) {
    falsePositiveKeys.add(`${row.merchant_normalized}:${row.cadence}`);
  }

  return candidates.filter((candidate) => {
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    return !falsePositiveKeys.has(key);
  });
}

async function buildUnusualAlerts(userId: string, tx90: TxRow[], tx180: TxRow[]): Promise<AlertInsert[]> {
  const byMerchant = new Map<string, number[]>();
  for (const tx of tx180) {
    const spend = expenseAmount(tx.amount);
    const merchant = tx.merchant_canonical ?? tx.merchant_normalized ?? "";
    if (spend <= 0 || !merchant) continue;
    const list = byMerchant.get(merchant) ?? [];
    list.push(spend);
    byMerchant.set(merchant, list);
  }

  const alerts: AlertInsert[] = [];
  for (const tx of tx90) {
    const amount = round2(expenseAmount(tx.amount));
    if (amount <= 0) continue;
    const merchant = tx.merchant_canonical ?? tx.merchant_normalized ?? null;
    const history = merchant ? byMerchant.get(merchant) ?? [] : [];
    const med = history.length >= 5 ? median(history) : 0;
    const isUnusual = amount >= 500 || (history.length >= 5 && med > 0 && amount >= med * 3);
    if (!isUnusual) continue;

    const fingerprint = await sha256Hex(`${userId}|unusual_charge|${tx.id}`);
    alerts.push({
      user_id: userId,
      alert_type: "unusual_charge",
      severity: amount >= 1000 ? "high" : "medium",
      title: "Unusual charge detected",
      body: `${merchant ?? "A merchant"} charged ${formatUsd(amount)}. Review this transaction.`,
      fingerprint,
      merchant_normalized: merchant,
      amount,
      metadata: {
        basis: history.length >= 5 ? "merchant_median_or_threshold" : "threshold",
        median: med || null,
        day: toUtcDayKey(tx.posted_at),
      },
      reasoning: {
        trigger: history.length >= 5 ? "merchant_median_or_threshold" : "threshold_amount",
        amount,
        threshold_amount: 500,
        merchant_history_count: history.length,
        merchant_median: med || null,
        multiplier_threshold: history.length >= 5 ? 3 : null,
        posted_day: toUtcDayKey(tx.posted_at),
      },
    });
  }
  return alerts;
}

async function buildDuplicateAlerts(userId: string, tx90: TxRow[]): Promise<AlertInsert[]> {
  const byGroup = new Map<string, number[]>();
  for (const tx of tx90) {
    const amount = round2(expenseAmount(tx.amount));
    const merchant = tx.merchant_canonical ?? tx.merchant_normalized ?? "";
    if (amount <= 0 || !merchant) continue;
    const day = toUtcDayKey(tx.posted_at);
    const key = `${merchant}|${day}`;
    const list = byGroup.get(key) ?? [];
    list.push(amount);
    byGroup.set(key, list);
  }

  const alerts: AlertInsert[] = [];
  for (const [key, amounts] of byGroup.entries()) {
    if (amounts.length < 2) continue;
    const [merchant, day] = key.split("|");
    const byRounded = new Map<string, number[]>();
    for (const amount of amounts) {
      const roundedHalf = (Math.round(amount * 2) / 2).toFixed(2);
      const list = byRounded.get(roundedHalf) ?? [];
      list.push(amount);
      byRounded.set(roundedHalf, list);
    }

    for (const [roundedAmount, list] of byRounded.entries()) {
      if (list.length < 2) continue;
      const amount = Number.parseFloat(roundedAmount);
      const fingerprint = await sha256Hex(`${userId}|duplicate|${merchant}|${day}|${roundedAmount}`);
      alerts.push({
        user_id: userId,
        alert_type: "duplicate_charge",
        severity: list.length >= 3 ? "high" : "medium",
        title: "Possible duplicate charge",
        body: `${merchant} has ${list.length} similar charge(s) around ${formatUsd(amount)} on ${day}.`,
        fingerprint,
        merchant_normalized: merchant,
        amount,
        metadata: { day, count: list.length, rounded_amount: roundedAmount },
        reasoning: {
          trigger: "same_day_similar_amount",
          day,
          merchant,
          duplicate_count: list.length,
          rounded_amount: amount,
          tolerance: 0.5,
        },
      });
    }
  }

  return alerts;
}

async function buildSubscriptionIncreaseAlerts(
  userId: string,
  candidates: SubscriptionCandidate[],
): Promise<AlertInsert[]> {
  const alerts: AlertInsert[] = [];
  for (const sub of candidates) {
    if (sub.last_amount === null || sub.prev_amount === null) continue;
    if (sub.prev_amount <= 0 || sub.last_amount <= sub.prev_amount) continue;
    const delta = sub.last_amount - sub.prev_amount;
    const pct = delta / sub.prev_amount;
    if (delta < 1 && pct < 0.05) continue;

    const fingerprint = await sha256Hex(
      `${userId}|sub_increase|${sub.merchant_normalized}|${sub.last_charge_at}|${sub.last_amount}`,
    );
    alerts.push({
      user_id: userId,
      alert_type: "subscription_increase",
      severity: pct >= 0.2 ? "high" : "medium",
      title: "Subscription increased",
      body:
        `${sub.merchant_normalized} increased from ${formatUsd(sub.prev_amount)} to ${formatUsd(sub.last_amount)}.`,
      fingerprint,
      merchant_normalized: sub.merchant_normalized,
      amount: sub.last_amount,
      metadata: {
        cadence: sub.cadence,
        confidence: sub.confidence,
        delta: round2(delta),
        pct: round2(pct),
        last_charge_at: sub.last_charge_at,
      },
      reasoning: {
        trigger: "subscription_increase",
        cadence: sub.cadence,
        confidence: sub.confidence,
        previous_amount: round2(sub.prev_amount),
        last_amount: round2(sub.last_amount),
        absolute_delta: round2(delta),
        percent_delta: round2(pct),
        min_absolute_delta: 1,
        min_percent_delta: 0.05,
        last_charge_at: sub.last_charge_at,
      },
    });
  }
  return alerts;
}

async function buildPaceAlerts(
  userId: string,
  tx90: TxRow[],
  categoryNames: Map<string, string>,
): Promise<AlertInsert[]> {
  const { currentMonthKey, previousMonthKey, daysElapsed, daysInMonth } = getMonthInfoNow();
  const currentSpend = new Map<string, number>();
  const previousSpend = new Map<string, number>();

  for (const tx of tx90) {
    const amount = expenseAmount(tx.amount);
    if (amount <= 0) continue;

    const date = new Date(tx.posted_at);
    if (Number.isNaN(date.valueOf())) continue;
    const monthKey = monthKeyFromDate(date);

    const categoryId = tx.user_category_id ?? tx.category_id;
    const categoryLabel = categoryId ? categoryNames.get(categoryId) ?? categoryId : "uncategorized";

    if (monthKey === currentMonthKey) {
      currentSpend.set("overall", (currentSpend.get("overall") ?? 0) + amount);
      currentSpend.set(`category:${categoryLabel}`, (currentSpend.get(`category:${categoryLabel}`) ?? 0) + amount);
    } else if (monthKey === previousMonthKey) {
      previousSpend.set("overall", (previousSpend.get("overall") ?? 0) + amount);
      previousSpend.set(`category:${categoryLabel}`, (previousSpend.get(`category:${categoryLabel}`) ?? 0) + amount);
    }
  }

  const alerts: AlertInsert[] = [];
  const scopes = new Set<string>(["overall"]);
  for (const key of currentSpend.keys()) {
    if (key !== "overall") scopes.add(key);
  }

  const scopeResults: Array<{ scope: string; projected: number; lastMonth: number; ratio: number }> = [];
  for (const scope of scopes) {
    const mtd = currentSpend.get(scope) ?? 0;
    const lastMonth = previousSpend.get(scope) ?? 0;
    if (mtd <= 0 || lastMonth <= 0) continue;

    const projected = (mtd / Math.max(daysElapsed, 1)) * daysInMonth;
    const ratio = projected / lastMonth;
    if (ratio > 1.15) {
      scopeResults.push({ scope, projected, lastMonth, ratio });
    }
  }

  scopeResults.sort((a, b) => b.ratio - a.ratio);
  const selected = scopeResults.filter((item) => item.scope === "overall").concat(
    scopeResults.filter((item) => item.scope !== "overall").slice(0, 3),
  );

  for (const item of selected) {
    const fingerprint = await sha256Hex(`${userId}|pace|${currentMonthKey}|${item.scope}`);
    const scopeLabel = item.scope === "overall" ? "Overall spending" : item.scope.replace("category:", "Category ");
    alerts.push({
      user_id: userId,
      alert_type: "pace_warning",
      severity: item.ratio >= 1.3 ? "high" : "medium",
      title: "Monthly spend pace is elevated",
      body:
        `${scopeLabel} is pacing at ${formatUsd(item.projected)} vs last month ${formatUsd(item.lastMonth)}.`,
      fingerprint,
      merchant_normalized: null,
      amount: round2(item.projected),
      metadata: {
        scope: item.scope,
        month: currentMonthKey,
        projected: round2(item.projected),
        last_month: round2(item.lastMonth),
        ratio: round2(item.ratio),
      },
      reasoning: {
        trigger: "projected_monthly_overrun",
        scope: item.scope,
        month: currentMonthKey,
        projected_monthly_spend: round2(item.projected),
        previous_month_spend: round2(item.lastMonth),
        projected_ratio: round2(item.ratio),
        threshold_ratio: 1.15,
        days_elapsed: daysElapsed,
        days_in_month: daysInMonth,
      },
    });
  }

  return alerts;
}

async function filterExistingAlerts(
  admin: ReturnType<typeof createClient>,
  userId: string,
  alerts: AlertInsert[],
): Promise<AlertInsert[]> {
  if (alerts.length === 0) return [];

  const fingerprints = [...new Set(alerts.map((alert) => alert.fingerprint))];
  const existingKeys = new Set<string>();
  const chunkSize = 250;

  for (let i = 0; i < fingerprints.length; i += chunkSize) {
    const slice = fingerprints.slice(i, i + chunkSize);
    const { data, error } = await admin
      .from("alerts")
      .select("alert_type, fingerprint")
      .eq("user_id", userId)
      .in("fingerprint", slice);

    if (error) throw new Error("Could not check existing alerts.");
    for (const row of data ?? []) {
      existingKeys.add(`${row.alert_type}:${row.fingerprint}`);
    }
  }

  return alerts.filter((alert) => !existingKeys.has(`${alert.alert_type}:${alert.fingerprint}`));
}

async function filterAlertsByFeedback(
  admin: ReturnType<typeof createClient>,
  userId: string,
  alerts: AlertInsert[],
): Promise<{ alerts: AlertInsert[]; suppressedByFeedback: number }> {
  if (alerts.length === 0) {
    return { alerts: [], suppressedByFeedback: 0 };
  }

  const alertTypes = [...new Set(alerts.map((alert) => alert.alert_type))];
  const merchantKeys = [...new Set(alerts.map((alert) => feedbackMerchantKey(alert.merchant_normalized)))];

  const { data, error } = await admin
    .from("alert_feedback")
    .select("alert_type, merchant_canonical")
    .eq("user_id", userId)
    .in("alert_type", alertTypes)
    .in("merchant_canonical", merchantKeys);

  if (error) {
    throw new Error("Could not load alert feedback.");
  }

  const suppressionKeys = new Set<string>();
  for (const row of data ?? []) {
    const merchantKey = feedbackMerchantKey(typeof row.merchant_canonical === "string" ? row.merchant_canonical : null);
    suppressionKeys.add(`${row.alert_type}:${merchantKey}`);
  }

  const filtered = alerts.filter((alert) => {
    const merchantKey = feedbackMerchantKey(alert.merchant_normalized);
    return !suppressionKeys.has(`${alert.alert_type}:${merchantKey}`);
  });

  return {
    alerts: filtered,
    suppressedByFeedback: alerts.length - filtered.length,
  };
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const requestId = crypto.randomUUID();
    const manualUserId = isCronAuthorized(req) ? null : await resolveManualUserId(admin, req);
    if (!isCronAuthorized(req) && !manualUserId) {
      return json(req, { error: "Unauthorized." }, 401);
    }

    const users = manualUserId ? [manualUserId] : await listUserIdsWithAccounts(admin);
    const mode = manualUserId ? "manual" : "cron";
    let usersProcessed = 0;
    let subscriptionsUpserted = 0;
    let alertsInserted = 0;
    let metricsDaysUpserted = 0;
    const start90 = dateDaysAgo(LOOKBACK_90_DAYS);
    const start180 = dateDaysAgo(LOOKBACK_180_DAYS);
    const start730 = dateDaysAgo(LOOKBACK_730_DAYS);

    for (const userId of users) {
      try {
        const aliasMatchers = await fetchMerchantAliasMatchers(admin, userId);
        const transactionRules = await fetchTransactionRules(admin, userId);
        const tx730Raw = await fetchTransactions(admin, userId, start730);
        const tx730 = applyRulesToTransactions(tx730Raw, aliasMatchers, transactionRules);
        await persistTransactionRuleMatches(admin, userId, tx730);

        const tx180 = tx730.filter((tx) => new Date(tx.posted_at) >= start180);
        const tx90 = tx180.filter((tx) => new Date(tx.posted_at) >= start90);
        const categoryNames = await fetchCategoryNames(admin, userId, tx90);

        const metricsRows = buildMetricsRows(userId, tx90, categoryNames);
        if (metricsRows.length > 0) {
          const { error: metricsError } = await admin
            .from("user_metrics_daily")
            .upsert(metricsRows, { onConflict: "user_id,day" });
          if (metricsError) throw new Error("Could not upsert daily metrics.");
          metricsDaysUpserted += metricsRows.length;
        }

        const rawSubscriptions = buildSubscriptionCandidates(userId, tx180, tx730);
        const subscriptions = await filterFalsePositiveCandidates(admin, userId, rawSubscriptions);
        subscriptionsUpserted += await upsertSubscriptions(admin, userId, subscriptions);

        const unusualAlerts = await buildUnusualAlerts(userId, tx90, tx180);
        const duplicateAlerts = await buildDuplicateAlerts(userId, tx90);
        const subscriptionAlerts = await buildSubscriptionIncreaseAlerts(userId, subscriptions);
        const paceAlerts = await buildPaceAlerts(userId, tx90, categoryNames);

        const pendingAlerts = await filterExistingAlerts(admin, userId, [
          ...unusualAlerts,
          ...duplicateAlerts,
          ...subscriptionAlerts,
          ...paceAlerts,
        ]);
        const feedbackFiltered = await filterAlertsByFeedback(admin, userId, pendingAlerts);

        if (feedbackFiltered.alerts.length > 0) {
          const { error: alertInsertError } = await admin
            .from("alerts")
            .upsert(feedbackFiltered.alerts, {
              onConflict: "user_id,alert_type,fingerprint",
              ignoreDuplicates: true,
            });
          if (alertInsertError) throw new Error("Could not insert alerts.");
          alertsInserted += feedbackFiltered.alerts.length;
        }

        usersProcessed += 1;
        console.log(
          JSON.stringify({
            user_id: userId,
            tx90_count: tx90.length,
            subscriptions_upserted: subscriptions.length,
            alerts_attempted: feedbackFiltered.alerts.length,
            alerts_suppressed_by_feedback: feedbackFiltered.suppressedByFeedback,
            metrics_days: metricsRows.length,
          }),
        );
      } catch (error) {
        const details = errorInfo(error);
        console.error(JSON.stringify({
          function: FUNCTION_NAME,
          action: "analyze_user",
          request_id: requestId,
          user_id: userId,
          message: details.message,
          stack: details.stack,
        }));
      }
    }

    return json(req, {
      ok: true,
      request_id: requestId,
      mode,
      timezone_basis: "UTC",
      users_processed: usersProcessed,
      subscriptions_upserted: subscriptionsUpserted,
      alerts_inserted: alertsInserted,
      metrics_days_upserted: metricsDaysUpserted,
    });
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "run_analysis",
      mode: isCronAuthorized(req) ? "cron" : "manual",
      message: details.message,
      stack: details.stack,
    }));
    return json(
      req,
      {
        error: "Daily analysis failed.",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
