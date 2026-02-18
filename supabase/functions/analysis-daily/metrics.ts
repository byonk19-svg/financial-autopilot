import { METRICS_WINDOW_DAYS } from "./constants.ts";
import type { MetricsRow, TxRow } from "./types.ts";
import { addDays, expenseAmount, isDiscretionary, round2, toUtcDayKey } from "./utils.ts";

export function buildMetricsRows(userId: string, tx90: TxRow[], categoryNames: Map<string, string>): MetricsRow[] {
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
