import { ESSENTIAL_KEYWORDS } from "./constants.ts";
import type { TxRow, TransactionRuleRow } from "./types.ts";

export function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function expenseAmount(value: number | string): number {
  const parsed = toNumber(value);
  return parsed < 0 ? Math.abs(parsed) : 0;
}

export function dateDaysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function toUtcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function parseDayKey(day: string): Date {
  const [year, month, date] = day.split("-").map((token) => Number.parseInt(token, 10));
  return new Date(Date.UTC(year, month - 1, date));
}

export function addDays(day: string, days: number): string {
  const base = parseDayKey(day);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDayKey(b).getTime() - parseDayKey(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function errorInfo(error: unknown): { message: string; stack: string | null } {
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

export function normalizeMatchInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesRulePattern(matchType: TransactionRuleRow["match_type"], pattern: string, haystack: string): boolean {
  const normalizedPattern = normalizeMatchInput(pattern);
  if (!normalizedPattern) return false;

  if (matchType === "equals") {
    return haystack === normalizedPattern;
  }

  if (matchType === "regex") {
    try {
      const regex = new RegExp(pattern, "i");
      return regex.test(haystack);
    } catch {
      return false;
    }
  }

  return haystack.includes(normalizedPattern);
}

export function isEssentialLabel(label: string): boolean {
  const value = label.toLowerCase();
  return ESSENTIAL_KEYWORDS.some((keyword) => value.includes(keyword));
}

export function isDiscretionary(tx: TxRow, categoryNames: Map<string, string>): boolean {
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

export function monthKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getMonthInfoNow(): {
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

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function feedbackMerchantKey(merchant: string | null): string {
  const normalized = (merchant ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "__unscoped__";
}
