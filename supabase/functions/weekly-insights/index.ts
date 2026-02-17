import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getCronSecret, getSupabaseConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } =
  getSupabaseConfig();
const CRON_SECRET = getCronSecret();

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-cron-secret";
const ALLOW_METHODS = "POST, OPTIONS";
const FUNCTION_NAME = "weekly-insights";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type TransactionRow = {
  amount: number | string;
  posted_at: string;
  merchant_normalized: string | null;
  category_id: string | null;
  user_category_id: string | null;
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

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length).trim();
}

function isCronRequest(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const providedSecret = req.headers.get("x-cron-secret");
  return Boolean(providedSecret && providedSecret === CRON_SECRET);
}

function toNumber(input: number | string): number {
  if (typeof input === "number") return input;
  const parsed = Number.parseFloat(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfIsoWeek(input: Date): Date {
  const copy = new Date(input.toISOString());
  const day = (copy.getUTCDay() + 6) % 7; // monday=0 ... sunday=6
  copy.setUTCDate(copy.getUTCDate() - day);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(input: Date, days: number): Date {
  const copy = new Date(input.toISOString());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function percentChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "no change";
  if (previous === 0) return "up from zero";
  const pct = ((current - previous) / previous) * 100;
  const direction = pct >= 0 ? "up" : "down";
  return `${direction} ${Math.abs(pct).toFixed(0)}%`;
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

async function resolveUserIds(
  adminClient: ReturnType<typeof createClient>,
  mode: "manual" | "cron",
  manualUserId: string | null,
): Promise<string[]> {
  if (mode === "manual") {
    return manualUserId ? [manualUserId] : [];
  }

  const { data: connections, error: connectionsError } = await adminClient
    .from("bank_connections")
    .select("user_id")
    .eq("provider", "simplefin")
    .eq("status", "active");

  if (connectionsError) {
    throw new HttpError(500, "Could not resolve users.");
  }

  const connectionUsers = [...new Set((connections ?? []).map((row) => row.user_id))];
  if (connectionUsers.length === 0) return [];

  const { data: preferences } = await adminClient
    .from("autopilot_feed_preferences")
    .select("user_id, weekly_insights_enabled")
    .in("user_id", connectionUsers);

  const disabledUsers = new Set(
    (preferences ?? [])
      .filter((row) => row.weekly_insights_enabled === false)
      .map((row) => row.user_id),
  );

  return connectionUsers.filter((userId) => !disabledUsers.has(userId));
}

async function buildWeeklyInsight(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  sourceKey: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}> {
  const now = new Date();
  const thisWeekStart = startOfIsoWeek(now);
  const currentWeekStart = addDays(thisWeekStart, -7);
  const previousWeekStart = addDays(thisWeekStart, -14);
  const previousWeekEnd = currentWeekStart;
  const currentWeekEnd = thisWeekStart;

  const { data: transactions, error: transactionsError } = await adminClient
    .from("transactions")
    .select("amount, posted_at, merchant_normalized, category_id, user_category_id")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .eq("is_pending", false)
    .gte("posted_at", previousWeekStart.toISOString())
    .lt("posted_at", currentWeekEnd.toISOString());

  if (transactionsError) {
    throw new HttpError(500, "Could not read transactions for insights.");
  }

  const rows = (transactions ?? []) as TransactionRow[];

  let currentSpend = 0;
  let previousSpend = 0;
  let currentIncome = 0;
  let previousIncome = 0;

  const merchantSpend = new Map<string, number>();
  const categorySpend = new Map<string, number>();

  for (const row of rows) {
    const amount = toNumber(row.amount);
    const postedAt = new Date(row.posted_at);
    const inCurrent = postedAt >= currentWeekStart && postedAt < currentWeekEnd;
    const inPrevious = postedAt >= previousWeekStart && postedAt < previousWeekEnd;

    if (!inCurrent && !inPrevious) continue;

    const spend = amount < 0 ? Math.abs(amount) : 0;
    const income = amount > 0 ? amount : 0;

    if (inCurrent) {
      currentSpend += spend;
      currentIncome += income;

      if (spend > 0) {
        const merchant = row.merchant_normalized?.trim() || "uncategorized merchant";
        merchantSpend.set(merchant, (merchantSpend.get(merchant) ?? 0) + spend);

        const categoryId = row.user_category_id ?? row.category_id ?? "uncategorized";
        categorySpend.set(categoryId, (categorySpend.get(categoryId) ?? 0) + spend);
      }
    }

    if (inPrevious) {
      previousSpend += spend;
      previousIncome += income;
    }
  }

  let topMerchant = "none";
  let topMerchantSpend = 0;
  for (const [merchant, value] of merchantSpend.entries()) {
    if (value > topMerchantSpend) {
      topMerchant = merchant;
      topMerchantSpend = value;
    }
  }

  let topCategoryId = "uncategorized";
  let topCategorySpend = 0;
  for (const [categoryId, value] of categorySpend.entries()) {
    if (value > topCategorySpend) {
      topCategoryId = categoryId;
      topCategorySpend = value;
    }
  }

  let topCategory = "Uncategorized";
  if (topCategoryId !== "uncategorized") {
    const { data: category } = await adminClient
      .from("categories")
      .select("name")
      .eq("id", topCategoryId)
      .maybeSingle();
    if (category?.name) {
      topCategory = category.name;
    }
  }

  const sourceKey = `weekly:${currentWeekStart.toISOString().slice(0, 10)}`;
  const spendChange = percentChange(currentSpend, previousSpend);
  const incomeChange = percentChange(currentIncome, previousIncome);

  const summary = `Spent ${formatUsd(currentSpend)} this week (${spendChange} vs prior week). Income was ${formatUsd(currentIncome)} (${incomeChange}). Top merchant: ${topMerchant} (${formatUsd(topMerchantSpend)}).`;

  return {
    sourceKey,
    title: "Weekly Financial Insight",
    summary,
    payload: {
      currentWeekStart: currentWeekStart.toISOString(),
      currentWeekEnd: currentWeekEnd.toISOString(),
      previousWeekStart: previousWeekStart.toISOString(),
      previousWeekEnd: previousWeekEnd.toISOString(),
      currentSpend,
      previousSpend,
      currentIncome,
      previousIncome,
      topMerchant,
      topMerchantSpend,
      topCategory,
      topCategorySpend,
    },
  };
}

async function upsertFeedItem(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  item: { sourceKey: string; title: string; summary: string; payload: Record<string, unknown> },
): Promise<void> {
  const { error } = await adminClient
    .from("autopilot_feed_items")
    .upsert(
      {
        user_id: userId,
        source_key: item.sourceKey,
        item_type: "weekly_insight",
        title: item.title,
        summary: item.summary,
        payload: item.payload,
        action_label: "View transactions",
        action_url: "/transactions",
        is_read: false,
      },
      { onConflict: "user_id,source_key" },
    );

  if (error) {
    throw new HttpError(500, "Could not write weekly insight.");
  }
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

  let mode: "manual" | "cron" = "manual";
  let manualUserId: string | null = null;

  try {
    if (isCronRequest(req)) {
      mode = "cron";
    } else {
      const jwt = getBearerToken(req);
      if (!jwt) {
        throw new HttpError(401, "Unauthorized.");
      }
      manualUserId = await getManualUserId(jwt);
    }
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "authorize_request",
      mode,
      user_id: manualUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Unauthorized." }, 401);
  }

  try {
    const userIds = await resolveUserIds(adminClient, mode, manualUserId);
    let insightsCreated = 0;
    const warnings: string[] = [];

    for (const userId of userIds) {
      try {
        const insight = await buildWeeklyInsight(adminClient, userId);
        await upsertFeedItem(adminClient, userId, insight);
        insightsCreated += 1;
      } catch (error) {
        const details = errorInfo(error);
        console.error(JSON.stringify({
          function: FUNCTION_NAME,
          action: "build_user_weekly_insight",
          mode,
          user_id: userId,
          message: details.message,
          stack: details.stack,
        }));
        const message = error instanceof Error ? error.message : "Unknown insight error.";
        warnings.push(`user ${userId}: ${message}`);
      }
    }

    return json(req, {
      ok: true,
      mode,
      usersProcessed: userIds.length,
      insightsCreated,
      warnings,
    });
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "run_weekly_insights",
      mode,
      user_id: manualUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Insight generation failed." }, 500);
  }
});
