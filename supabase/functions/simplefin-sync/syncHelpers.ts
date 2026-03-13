import { normalizeMerchantForRecurring } from "../_shared/merchant.ts";

export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength);
}

export function normalizeMerchantForSearch(input: string): string | null {
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

export function normalizeCanonicalMerchant(input: string): string | null {
  const canonical = normalizeMerchantForRecurring(input);
  return canonical === "UNKNOWN" ? null : canonical;
}

export function toUnixSeconds(input: Date): number {
  return Math.floor(input.getTime() / 1000);
}

export function addCalendarDays(input: Date, days: number): Date {
  const copy = new Date(input.toISOString());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}
