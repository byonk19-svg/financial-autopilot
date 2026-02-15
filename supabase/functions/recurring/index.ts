import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment configuration.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
  occurrences: number;
  classification: SubscriptionClassification;
  user_locked: boolean;
  classified_at: string | null;
  classified_by: string | null;
  updated_at: string;
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
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

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
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
  userId: string,
): Promise<Response> {
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id, merchant_normalized, cadence, confidence, last_amount, prev_amount, next_expected_at, occurrences, classification, user_locked, classified_at, classified_by, updated_at",
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

  return json({
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
  } catch {
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
      "id, merchant_normalized, cadence, confidence, last_amount, prev_amount, next_expected_at, occurrences, classification, user_locked, classified_at, classified_by, updated_at",
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

  return json({
    ok: true,
    recurring: updated,
    rule_created: createRule,
    event_logged: !eventError,
    warning: eventError ? "Classification saved, but event logging failed." : null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const userId = await resolveUserId(admin, req);
    const routeParts = parseRouteParts(new URL(req.url).pathname);

    if (req.method === "GET" && routeParts.length === 0) {
      return await listRecurring(admin, userId);
    }

    if (req.method === "POST" && routeParts.length === 2 && routeParts[1] === "classify") {
      return await classifyRecurring(admin, userId, routeParts[0], req);
    }

    return json({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: "Unhandled recurring handler error." }, 500);
  }
});
