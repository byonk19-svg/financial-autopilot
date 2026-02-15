import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET) {
  throw new Error("Missing required environment configuration.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InsightType = "pattern" | "opportunity" | "projection";

type MetricRow = {
  day: string;
  spend_total: number | string;
  spend_weekend: number | string;
  spend_weekday: number | string;
};

type SubscriptionRow = {
  merchant_normalized: string;
  cadence: "weekly" | "monthly" | "quarterly" | "yearly" | "unknown";
  classification: "needs_review" | "subscription" | "bill_loan" | "transfer" | "ignore";
  last_amount: number | string | null;
  prev_amount: number | string | null;
  last_charge_at: string | null;
  confidence: number | string;
  is_active: boolean;
};

type TransactionDriverRow = {
  amount: number | string;
  merchant_normalized: string | null;
  category_id: string | null;
  user_category_id: string | null;
};

type InsightDraft = {
  type: InsightType;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function isCronRequest(req: Request): boolean {
  const providedSecret = req.headers.get("x-cron-secret");
  return Boolean(providedSecret && providedSecret === CRON_SECRET);
}

function toNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function expenseAmount(value: number | string): number {
  const numeric = toNumber(value);
  return numeric < 0 ? Math.abs(numeric) : 0;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function partsInChicago(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  return { year, month, day };
}

function isoDateFromParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map((token) => Number.parseInt(token, 10));
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function weekdayFromIsoDate(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map((token) => Number.parseInt(token, 10));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getChicagoWeekOf(date: Date): string {
  const local = partsInChicago(date);
  const todayIso = isoDateFromParts(local);
  const weekday = weekdayFromIsoDate(todayIso);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(todayIso, mondayOffset);
}

function getMonthContextChicago(date: Date): {
  todayIso: string;
  currentMonthStart: string;
  previousMonthStart: string;
  currentMonthKey: string;
  previousMonthKey: string;
  daysElapsed: number;
  daysInMonth: number;
} {
  const local = partsInChicago(date);
  const todayIso = isoDateFromParts(local);
  const currentMonthStart = `${local.year}-${pad2(local.month)}-01`;
  const monthDate = new Date(Date.UTC(local.year, local.month - 1, 1));
  monthDate.setUTCMonth(monthDate.getUTCMonth() - 1);
  const previousMonthStart = `${monthDate.getUTCFullYear()}-${pad2(monthDate.getUTCMonth() + 1)}-01`;
  const currentMonthKey = currentMonthStart.slice(0, 7);
  const previousMonthKey = previousMonthStart.slice(0, 7);
  const daysElapsed = Math.max(local.day, 1);
  const daysInMonth = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();

  return {
    todayIso,
    currentMonthStart,
    previousMonthStart,
    currentMonthKey,
    previousMonthKey,
    daysElapsed,
    daysInMonth,
  };
}

function annualizedFromCadence(amount: number, cadence: SubscriptionRow["cadence"]): number {
  if (cadence === "weekly") return amount * 52;
  if (cadence === "monthly") return amount * 12;
  if (cadence === "quarterly") return amount * 4;
  if (cadence === "yearly") return amount;
  return amount * 12;
}

function truncateList(items: string[], maxItems: number): string {
  if (items.length <= maxItems) return items.join("; ");
  const shown = items.slice(0, maxItems);
  return `${shown.join("; ")}; +${items.length - maxItems} more`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function buildPatternInsight(
  admin: ReturnType<typeof createClient>,
  userId: string,
  todayIso: string,
): Promise<InsightDraft> {
  const startIso = addDays(todayIso, -13);
  const { data, error } = await admin
    .from("user_metrics_daily")
    .select("day, spend_total, spend_weekend, spend_weekday")
    .eq("user_id", userId)
    .gte("day", startIso)
    .lte("day", todayIso)
    .order("day", { ascending: true });

  if (error) {
    throw new Error("Could not load daily metrics.");
  }

  const rows = (data ?? []) as MetricRow[];
  let weekendSum = 0;
  let weekdaySum = 0;
  let weekendDays = 0;
  let weekdayDays = 0;

  for (const row of rows) {
    const dow = weekdayFromIsoDate(row.day);
    if (dow === 0 || dow === 6) {
      weekendDays += 1;
      weekendSum += toNumber(row.spend_weekend || row.spend_total);
    } else {
      weekdayDays += 1;
      weekdaySum += toNumber(row.spend_weekday || row.spend_total);
    }
  }

  const weekendAvg = weekendDays > 0 ? weekendSum / weekendDays : 0;
  const weekdayAvg = weekdayDays > 0 ? weekdaySum / weekdayDays : 0;
  const delta = weekendAvg - weekdayAvg;
  const pct = weekdayAvg > 0 ? (delta / weekdayAvg) * 100 : null;

  return {
    type: "pattern",
    title: "Weekend vs Weekday Pattern",
    body:
      `Last 14 days average spend/day: weekend ${formatUsd(weekendAvg)}, weekday ${formatUsd(weekdayAvg)}.` +
      (pct === null ? "" : ` Weekend is ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs weekday.`),
    data: {
      period_days: 14,
      weekend_avg_daily: round2(weekendAvg),
      weekday_avg_daily: round2(weekdayAvg),
      weekend_days: weekendDays,
      weekday_days: weekdayDays,
      delta: round2(delta),
      pct: pct === null ? null : round2(pct),
    },
  };
}

async function buildMoneyLeakInsight(
  admin: ReturnType<typeof createClient>,
  userId: string,
  todayIso: string,
): Promise<InsightDraft> {
  const sinceIso = addDays(todayIso, -30);

  const { data: rawSubs, error: subsError } = await admin
    .from("subscriptions")
    .select("merchant_normalized, cadence, classification, last_amount, prev_amount, last_charge_at, confidence, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("classification", "subscription")
    .gte("last_charge_at", sinceIso);

  if (subsError) {
    throw new Error("Could not load subscriptions.");
  }

  const subs = (rawSubs ?? []) as SubscriptionRow[];
  if (subs.length === 0) {
    return {
      type: "opportunity",
      title: "Money Leak Check",
      body: "No active subscription charges detected in the last 30 days.",
      data: { subscription_count: 0, annualized_total: 0, increases: 0 },
    };
  }

  const merchants = [...new Set(subs.map((sub) => sub.merchant_normalized))];
  const { data: rawTransactions, error: txError } = await admin
    .from("transactions")
    .select("merchant_normalized, amount, posted_at")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .eq("is_pending", false)
    .gte("posted_at", `${sinceIso}T00:00:00Z`)
    .in("merchant_normalized", merchants);

  if (txError) {
    throw new Error("Could not validate subscription charges.");
  }

  const txByMerchant = new Map<string, number>();
  for (const tx of rawTransactions ?? []) {
    const merchant = tx.merchant_normalized ?? "";
    if (!merchant) continue;
    const spend = expenseAmount(tx.amount);
    if (spend <= 0) continue;
    txByMerchant.set(merchant, (txByMerchant.get(merchant) ?? 0) + 1);
  }

  const matched = subs.filter((sub) => (txByMerchant.get(sub.merchant_normalized) ?? 0) > 0);
  if (matched.length === 0) {
    return {
      type: "opportunity",
      title: "Money Leak Check",
      body: "Subscriptions are configured, but no matching charges were found in the last 30 days.",
      data: { subscription_count: 0, annualized_total: 0, increases: 0 },
    };
  }

  const lines: string[] = [];
  let annualizedTotal = 0;
  let increaseCount = 0;

  const sorted = [...matched].sort((a, b) => toNumber(b.last_amount) - toNumber(a.last_amount));
  for (const sub of sorted) {
    const lastAmount = toNumber(sub.last_amount);
    const prevAmount = toNumber(sub.prev_amount);
    const annualized = annualizedFromCadence(lastAmount, sub.cadence);
    annualizedTotal += annualized;

    const increased = prevAmount > 0 && (lastAmount - prevAmount >= 1 || (lastAmount - prevAmount) / prevAmount >= 0.05);
    if (increased) increaseCount += 1;

    const increaseText = increased ? `, up from ${formatUsd(prevAmount)}` : "";
    lines.push(
      `${sub.merchant_normalized}: ${formatUsd(lastAmount)} (${sub.cadence}, ~${formatUsd(annualized)}/yr${increaseText})`,
    );
  }

  return {
    type: "opportunity",
    title: "Money Leak Check",
    body:
      `Active subscriptions charged in last 30 days: ${truncateList(lines, 4)}.` +
      ` Estimated annualized cost: ${formatUsd(annualizedTotal)}.` +
      (increaseCount > 0 ? ` Price increases detected: ${increaseCount}.` : ""),
    data: {
      subscription_count: matched.length,
      annualized_total: round2(annualizedTotal),
      increases: increaseCount,
      merchants: matched.map((sub) => sub.merchant_normalized),
    },
  };
}

async function buildProjectionInsight(
  admin: ReturnType<typeof createClient>,
  userId: string,
  ctx: ReturnType<typeof getMonthContextChicago>,
): Promise<InsightDraft> {
  const { currentMonthStart, previousMonthStart, currentMonthKey, previousMonthKey, todayIso, daysElapsed, daysInMonth } =
    ctx;

  const { data: rawMetrics, error: metricsError } = await admin
    .from("user_metrics_daily")
    .select("day, spend_total")
    .eq("user_id", userId)
    .gte("day", previousMonthStart)
    .lte("day", todayIso);

  if (metricsError) {
    throw new Error("Could not load month metrics.");
  }

  let mtdSpend = 0;
  let lastMonthTotal = 0;
  for (const row of rawMetrics ?? []) {
    const day = row.day as string;
    const spend = toNumber(row.spend_total as number | string);
    if (day.startsWith(currentMonthKey)) {
      mtdSpend += spend;
    } else if (day.startsWith(previousMonthKey)) {
      lastMonthTotal += spend;
    }
  }

  const projected = daysElapsed > 0 ? (mtdSpend / daysElapsed) * daysInMonth : 0;
  const ratio = lastMonthTotal > 0 ? projected / lastMonthTotal : null;

  const { data: rawDrivers, error: driverError } = await admin
    .from("transactions")
    .select("amount, merchant_normalized, category_id, user_category_id")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .eq("is_pending", false)
    .gte("posted_at", `${currentMonthStart}T00:00:00Z`);

  if (driverError) {
    throw new Error("Could not load projection drivers.");
  }

  const driverRows = (rawDrivers ?? []) as TransactionDriverRow[];
  const merchantSpend = new Map<string, number>();
  const categorySpend = new Map<string, number>();
  const categoryIds = new Set<string>();

  for (const row of driverRows) {
    const spend = expenseAmount(row.amount);
    if (spend <= 0) continue;

    const merchant = (row.merchant_normalized ?? "").trim();
    if (merchant) {
      merchantSpend.set(merchant, (merchantSpend.get(merchant) ?? 0) + spend);
    }

    const categoryId = row.user_category_id ?? row.category_id;
    if (categoryId) {
      categoryIds.add(categoryId);
      categorySpend.set(categoryId, (categorySpend.get(categoryId) ?? 0) + spend);
    }
  }

  const categoryNameById = new Map<string, string>();
  if (categoryIds.size > 0) {
    const { data: categories } = await admin
      .from("categories")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", [...categoryIds]);

    for (const row of categories ?? []) {
      categoryNameById.set(row.id, row.name);
    }
  }

  let topMerchantLabel = "";
  let topMerchantAmount = 0;
  for (const [label, amount] of merchantSpend.entries()) {
    if (amount > topMerchantAmount) {
      topMerchantAmount = amount;
      topMerchantLabel = label;
    }
  }

  let topCategoryLabel = "";
  let topCategoryAmount = 0;
  for (const [id, amount] of categorySpend.entries()) {
    if (amount > topCategoryAmount) {
      topCategoryAmount = amount;
      topCategoryLabel = categoryNameById.get(id) ?? id;
    }
  }

  const topDriver =
    topMerchantAmount >= topCategoryAmount && topMerchantLabel
      ? `Top driver merchant: ${topMerchantLabel} (${formatUsd(topMerchantAmount)}).`
      : topCategoryLabel
      ? `Top driver category: ${topCategoryLabel} (${formatUsd(topCategoryAmount)}).`
      : "No clear driver this month.";

  return {
    type: "projection",
    title: "Month Pace Projection",
    body:
      `Month-to-date spend is ${formatUsd(mtdSpend)} over ${daysElapsed} day(s), pacing ${formatUsd(projected)} for the month.` +
      ` Last month total was ${formatUsd(lastMonthTotal)}.` +
      (ratio === null ? "" : ` Pace vs last month: ${(ratio * 100).toFixed(1)}%.`) +
      ` ${topDriver}`,
    data: {
      month: currentMonthKey,
      mtd_spend: round2(mtdSpend),
      projected_spend: round2(projected),
      last_month_total: round2(lastMonthTotal),
      pace_ratio: ratio === null ? null : round2(ratio),
      top_driver_merchant: topMerchantLabel || null,
      top_driver_merchant_amount: topMerchantLabel ? round2(topMerchantAmount) : null,
      top_driver_category: topCategoryLabel || null,
      top_driver_category_amount: topCategoryLabel ? round2(topCategoryAmount) : null,
    },
  };
}

async function buildUserInsights(
  admin: ReturnType<typeof createClient>,
  userId: string,
  now: Date,
): Promise<{ weekOf: string; drafts: InsightDraft[] }> {
  const weekOf = getChicagoWeekOf(now);
  const monthCtx = getMonthContextChicago(now);
  const pattern = await buildPatternInsight(admin, userId, monthCtx.todayIso);
  const moneyLeak = await buildMoneyLeakInsight(admin, userId, monthCtx.todayIso);
  const projection = await buildProjectionInsight(admin, userId, monthCtx);

  return {
    weekOf,
    drafts: [pattern, moneyLeak, projection],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!isCronRequest(req)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const { data: accountRows, error: accountError } = await admin
      .from("accounts")
      .select("user_id");

    if (accountError) {
      return json({ error: "Could not resolve users." }, 500);
    }

    const userIds = [...new Set((accountRows ?? []).map((row) => row.user_id).filter(Boolean))];
    const now = new Date();
    let usersProcessed = 0;
    let insightsUpserted = 0;
    const warnings: string[] = [];

    for (const userId of userIds) {
      try {
        const { weekOf, drafts } = await buildUserInsights(admin, userId, now);

        await admin
          .from("insights")
          .delete()
          .eq("user_id", userId)
          .eq("week_of", weekOf)
          .eq("type", "warning");

        const payload = drafts.map((draft) => ({
          user_id: userId,
          week_of: weekOf,
          type: draft.type,
          title: draft.title,
          body: draft.body,
          data: draft.data,
        }));

        const { error: upsertError } = await admin
          .from("insights")
          .upsert(payload, { onConflict: "user_id,week_of,type" });

        if (upsertError) {
          throw new Error("Could not upsert weekly insights.");
        }

        usersProcessed += 1;
        insightsUpserted += payload.length;
      } catch {
        warnings.push(`user ${userId}: failed`);
      }
    }

    return json({
      ok: true,
      users_processed: usersProcessed,
      users_with_accounts: userIds.length,
      insights_upserted: insightsUpserted,
      per_user_expected: 3,
      week_of_basis: "date_trunc(week, America/Chicago)",
      warnings,
    });
  } catch {
    return json({ error: "Weekly insight generation failed." }, 500);
  }
});
