import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { sha256Hex } from "../_shared/hash.ts";
import type { AlertInsert, SubscriptionCandidate, TxRow } from "./types.ts";
import { expenseAmount, feedbackMerchantKey, formatUsd, getMonthInfoNow, median, monthKeyFromDate, round2, toUtcDayKey } from "./utils.ts";

export async function buildUnusualAlerts(userId: string, tx90: TxRow[], tx180: TxRow[]): Promise<AlertInsert[]> {
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

export async function buildDuplicateAlerts(userId: string, tx90: TxRow[]): Promise<AlertInsert[]> {
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

export async function buildSubscriptionIncreaseAlerts(
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

export async function buildPaceAlerts(
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

export async function filterExistingAlerts(
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

export async function filterAlertsByFeedback(
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
