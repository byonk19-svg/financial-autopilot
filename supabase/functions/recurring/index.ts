import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSupabaseConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseConfig();

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOW_METHODS = "GET, POST, OPTIONS";
const FUNCTION_NAME = "recurring";

const ALLOWED_CLASSIFICATIONS = new Set([
  "needs_review",
  "subscription",
  "bill_loan",
  "transfer",
  "ignore",
]);

type SubscriptionClassification = "needs_review" | "subscription" | "bill_loan" | "transfer" | "ignore";

type SubscriptionRow = {
  id: string;
  user_id: string;
  merchant_normalized: string;
  cadence: string;
  confidence: number | string;
  last_amount: number | string | null;
  prev_amount: number | string | null;
  next_expected_at: string | null;
  notify_days_before: number | null;
  occurrences: number;
  classification: SubscriptionClassification;
  is_false_positive: boolean;
  user_locked: boolean;
  classified_at: string | null;
  classified_by: string | null;
  updated_at: string;
};

type HistoryTxRow = {
  id: string;
  posted_at: string;
  amount: number | string;
  description_short: string;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  account_id: string;
  category_id: string | null;
};

type HistoryResponseRow = {
  id: string;
  posted_at: string;
  amount: number | string;
  description_short: string;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  account_id: string;
  account_name: string | null;
  category_id: string | null;
};

type ClassifyBody = {
  classification: SubscriptionClassification;
  lock?: boolean;
  createRule?: boolean;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

function parseRouteParts(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const recurringIndex = parts.lastIndexOf("recurring");
  if (recurringIndex === -1) return [];
  return parts.slice(recurringIndex + 1);
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
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

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function applyNullableFilter<T>(
  query: T,
  column: string,
  value: string | number | null,
): T {
  const mutable = query as unknown as {
    eq: (col: string, val: string | number) => T;
    is: (col: string, val: null) => T;
  };
  return value === null ? mutable.is(column, null) : mutable.eq(column, value);
}

async function resolveUserId(
  admin: ReturnType<typeof createClient>,
  req: Request,
): Promise<string> {
  const token = getBearerToken(req);
  if (!token) {
    throw new HttpError(401, "Unauthorized.");
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized.");
  }

  return data.user.id;
}

async function listRecurring(
  admin: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
): Promise<Response> {
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id, merchant_normalized, cadence, confidence, last_amount, prev_amount, next_expected_at, notify_days_before, occurrences, classification, is_false_positive, user_locked, classified_at, classified_by, updated_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Could not load recurring patterns.");
  }

  const grouped: Record<SubscriptionClassification, SubscriptionRow[]> = {
    needs_review: [],
    subscription: [],
    bill_loan: [],
    transfer: [],
    ignore: [],
  };

  for (const row of (data ?? []) as SubscriptionRow[]) {
    const key = ALLOWED_CLASSIFICATIONS.has(row.classification) ? row.classification : "needs_review";
    grouped[key as SubscriptionClassification].push(row);
  }

  return json(req, {
    ok: true,
    grouped,
    counts: {
      needs_review: grouped.needs_review.length,
      subscription: grouped.subscription.length,
      bill_loan: grouped.bill_loan.length,
      transfer: grouped.transfer.length,
      ignore: grouped.ignore.length,
      total: Object.values(grouped).reduce((sum, items) => sum + items.length, 0),
    },
  });
}

async function listSubscriptionHistory(
  admin: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  recurringId: string,
): Promise<Response> {
  if (!isUuid(recurringId)) {
    throw new HttpError(400, "Invalid recurring pattern id.");
  }

  const { data: recurring, error: recurringError } = await admin
    .from("subscriptions")
    .select("id, merchant_normalized")
    .eq("id", recurringId)
    .eq("user_id", userId)
    .maybeSingle();

  if (recurringError) {
    throw new HttpError(500, "Could not load recurring pattern.");
  }

  if (!recurring) {
    throw new HttpError(404, "Recurring pattern not found.");
  }

  const searchParams = new URL(req.url).searchParams;
  const requestedLimit = toInt(searchParams.get("limit"));
  const limit = requestedLimit === null ? 24 : Math.max(6, Math.min(48, requestedLimit));

  const [canonicalResult, normalizedResult] = await Promise.all([
    admin
      .from("transactions")
      .select(
        "id, posted_at, amount, description_short, merchant_canonical, merchant_normalized, account_id, category_id",
      )
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .eq("merchant_canonical", recurring.merchant_normalized)
      .order("posted_at", { ascending: false })
      .limit(limit),
    admin
      .from("transactions")
      .select(
        "id, posted_at, amount, description_short, merchant_canonical, merchant_normalized, account_id, category_id",
      )
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .eq("merchant_normalized", recurring.merchant_normalized)
      .order("posted_at", { ascending: false })
      .limit(limit),
  ]);

  if (canonicalResult.error || normalizedResult.error) {
    throw new HttpError(500, "Could not load linked transactions.");
  }

  const merged = new Map<string, HistoryTxRow>();
  for (const row of (canonicalResult.data ?? []) as HistoryTxRow[]) {
    merged.set(row.id, row);
  }
  for (const row of (normalizedResult.data ?? []) as HistoryTxRow[]) {
    merged.set(row.id, row);
  }

  const ordered = [...merged.values()]
    .sort((a, b) => (a.posted_at > b.posted_at ? -1 : 1))
    .slice(0, limit);

  const accountIds = [...new Set(ordered.map((row) => row.account_id))];
  const accountNames = new Map<string, string>();
  if (accountIds.length > 0) {
    const { data: accounts, error: accountError } = await admin
      .from("accounts")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", accountIds);

    if (accountError) {
      throw new HttpError(500, "Could not load account names.");
    }

    for (const row of accounts ?? []) {
      accountNames.set(row.id, row.name);
    }
  }

  const history: HistoryResponseRow[] = ordered.map((row) => ({
    ...row,
    account_name: accountNames.get(row.account_id) ?? null,
  }));

  const daily_totals: Record<string, number> = {};
  for (const row of history) {
    const day = row.posted_at.slice(0, 10);
    const absAmount = Math.abs(
      typeof row.amount === "number" ? row.amount : Number.parseFloat(String(row.amount)),
    );
    if (Number.isFinite(absAmount)) {
      daily_totals[day] = round2((daily_totals[day] ?? 0) + absAmount);
    }
  }

  return json(req, {
    ok: true,
    recurring_id: recurringId,
    merchant_normalized: recurring.merchant_normalized,
    history,
    daily_totals,
    count: history.length,
  });
}

async function upsertClassificationRule(
  admin: ReturnType<typeof createClient>,
  userId: string,
  merchantNormalized: string,
  cadence: string,
  classification: SubscriptionClassification,
  lastAmount: number | string | null,
): Promise<void> {
  const amount = toNumber(lastAmount);
  let minAmount: number | null = null;
  let maxAmount: number | null = null;

  if (amount !== null && amount > 0) {
    const tolerance = Math.max(1, amount * 0.05);
    minAmount = round2(Math.max(0, amount - tolerance));
    maxAmount = round2(amount + tolerance);
  }

  let query = admin
    .from("recurring_classification_rules")
    .select("id")
    .eq("user_id", userId)
    .eq("merchant_normalized", merchantNormalized)
    .eq("classification", classification)
    .limit(1);

  query = applyNullableFilter(query, "cadence", cadence || null);
  query = applyNullableFilter(query, "min_amount", minAmount);
  query = applyNullableFilter(query, "max_amount", maxAmount);

  const { data: existingRule, error: existingRuleError } = await query.maybeSingle();
  if (existingRuleError) {
    throw new HttpError(500, "Could not check existing classification rules.");
  }

  if (existingRule?.id) {
    const { error: updateError } = await admin
      .from("recurring_classification_rules")
      .update({
        is_active: true,
        classification,
      })
      .eq("id", existingRule.id)
      .eq("user_id", userId);

    if (updateError) {
      throw new HttpError(500, "Could not update classification rule.");
    }
    return;
  }

  const { error: insertError } = await admin
    .from("recurring_classification_rules")
    .insert({
      user_id: userId,
      merchant_normalized: merchantNormalized,
      cadence: cadence || null,
      min_amount: minAmount,
      max_amount: maxAmount,
      classification,
      is_active: true,
    });

  if (insertError) {
    throw new HttpError(500, "Could not create classification rule.");
  }
}

async function classifyRecurring(
  admin: ReturnType<typeof createClient>,
  userId: string,
  recurringId: string,
  req: Request,
): Promise<Response> {
  if (!isUuid(recurringId)) {
    throw new HttpError(400, "Invalid recurring pattern id.");
  }

  let body: ClassifyBody;
  try {
    body = (await req.json()) as ClassifyBody;
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "parse_classify_body",
      user_id: userId,
      recurring_id: recurringId,
      message: details.message,
      stack: details.stack,
    }));
    throw new HttpError(400, "Invalid JSON body.");
  }

  const classification = body?.classification;
  if (typeof classification !== "string" || !ALLOWED_CLASSIFICATIONS.has(classification)) {
    throw new HttpError(400, "Invalid classification value.");
  }

  if (body.lock !== undefined && typeof body.lock !== "boolean") {
    throw new HttpError(400, "lock must be a boolean when provided.");
  }

  if (body.createRule !== undefined && typeof body.createRule !== "boolean") {
    throw new HttpError(400, "createRule must be a boolean when provided.");
  }

  const lock = body.lock ?? true;
  const createRule = body.createRule === true;

  const { data: existing, error: existingError } = await admin
    .from("subscriptions")
    .select("id, user_id, merchant_normalized, cadence, last_amount, classification, user_locked")
    .eq("id", recurringId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new HttpError(500, "Could not load recurring pattern.");
  }

  if (!existing) {
    throw new HttpError(404, "Recurring pattern not found.");
  }

  const { data: updated, error: updateError } = await admin
    .from("subscriptions")
    .update({
      classification,
      user_locked: lock,
      classified_at: new Date().toISOString(),
      classified_by: userId,
    })
    .eq("id", recurringId)
    .eq("user_id", userId)
    .select(
      "id, merchant_normalized, cadence, confidence, last_amount, prev_amount, next_expected_at, notify_days_before, occurrences, classification, is_false_positive, user_locked, classified_at, classified_by, updated_at",
    )
    .single();

  if (updateError || !updated) {
    throw new HttpError(500, "Could not classify recurring pattern.");
  }

  if (createRule) {
    await upsertClassificationRule(
      admin,
      userId,
      existing.merchant_normalized,
      existing.cadence,
      classification,
      existing.last_amount,
    );
  }

  const { error: eventError } = await admin
    .from("recurring_classification_events")
    .insert({
      user_id: userId,
      subscription_id: existing.id,
      old_classification: existing.classification,
      new_classification: classification,
      old_user_locked: existing.user_locked === true,
      new_user_locked: lock,
      create_rule: createRule,
    });

  return json(req, {
    ok: true,
    recurring: updated,
    rule_created: createRule,
    event_logged: !eventError,
    warning: eventError ? "Classification saved, but event logging failed." : null,
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: ALLOW_HEADERS,
    allowMethods: ALLOW_METHODS,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let resolvedUserId: string | null = null;

  try {
    const userId = await resolveUserId(admin, req);
    resolvedUserId = userId;
    const routeParts = parseRouteParts(new URL(req.url).pathname);

    if (req.method === "GET" && routeParts.length === 0) {
      return await listRecurring(admin, req, userId);
    }

    if (req.method === "GET" && routeParts.length === 2 && routeParts[1] === "history") {
      return await listSubscriptionHistory(admin, req, userId, routeParts[0]);
    }

    if (req.method === "POST" && routeParts.length === 2 && routeParts[1] === "classify") {
      return await classifyRecurring(admin, userId, routeParts[0], req);
    }

    return json(req, { error: "Not found." }, 404);
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "handle_request",
      method: req.method,
      path: new URL(req.url).pathname,
      user_id: resolvedUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Unhandled recurring handler error." }, 500);
  }
});
