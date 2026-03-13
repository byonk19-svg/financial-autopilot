import type { TransactionMatchRow } from "./types.ts";
import { HttpError } from "./request.ts";

type AdminClient = {
  from: (table: string) => any;
};

const STALE_PENDING_DAYS = 7;
const PENDING_MATCH_WINDOW_DAYS = 10;
const AMOUNT_EPSILON = 0.01;

export function toFiniteNumber(value: number | string): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeForLooseMatch(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function merchantForMatch(
  row: Pick<TransactionMatchRow, "merchant_canonical" | "merchant_normalized" | "description_short">,
): string {
  return normalizeForLooseMatch(
    row.merchant_canonical ??
      row.merchant_normalized ??
      row.description_short,
  );
}

export function merchantMatchesLoose(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.includes(a)) return true;
  if (b.length >= 5 && a.includes(b)) return true;
  return false;
}

export function daysBetweenIso(a: string, b: string): number {
  const aDate = new Date(a);
  const bDate = new Date(b);
  if (Number.isNaN(aDate.getTime()) || Number.isNaN(bDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((aDate.getTime() - bDate.getTime()) / (24 * 60 * 60 * 1000)));
}

export function toMatchDate(row: Pick<TransactionMatchRow, "authorized_at" | "posted_at">): string {
  return row.authorized_at ?? row.posted_at;
}

export function findPendingMatches(
  candidates: TransactionMatchRow[],
  posted: TransactionMatchRow[],
): string[] {
  const matchedPendingIds: string[] = [];
  const usedPostedIds = new Set<string>();

  for (const pending of candidates) {
    const pendingAmount = toFiniteNumber(pending.amount);
    if (pendingAmount === null) continue;

    const pendingMatchDate = toMatchDate(pending);
    const pendingMerchant = merchantForMatch(pending);

    const match = posted.find((postedRow) => {
      if (usedPostedIds.has(postedRow.id)) return false;

      const postedAmount = toFiniteNumber(postedRow.amount);
      if (postedAmount === null) return false;
      if (Math.abs(Math.abs(postedAmount) - Math.abs(pendingAmount)) > AMOUNT_EPSILON) return false;

      const postedMatchDate = toMatchDate(postedRow);
      if (daysBetweenIso(pendingMatchDate, postedMatchDate) > PENDING_MATCH_WINDOW_DAYS) return false;

      const postedMerchant = merchantForMatch(postedRow);
      return merchantMatchesLoose(pendingMerchant, postedMerchant);
    });

    if (!match) continue;
    usedPostedIds.add(match.id);
    matchedPendingIds.push(pending.id);
  }

  return matchedPendingIds;
}

export async function reconcileStalePendingTransactions(
  adminClient: AdminClient,
  userId: string,
  accountId: string,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_PENDING_DAYS);

  const { data: stalePendingRows, error: stalePendingError } = await adminClient
    .from("transactions")
    .select("id, posted_at, authorized_at, amount, merchant_canonical, merchant_normalized, description_short")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_deleted", false)
    .eq("is_pending", true)
    .lte("posted_at", cutoff.toISOString())
    .order("posted_at", { ascending: true })
    .limit(5000);

  if (stalePendingError) {
    throw new HttpError(500, "Could not read stale pending transactions.");
  }

  const candidates = (stalePendingRows ?? []) as TransactionMatchRow[];
  if (candidates.length === 0) return 0;

  let earliest = toMatchDate(candidates[0]);
  for (const candidate of candidates) {
    const candidateDate = toMatchDate(candidate);
    if (candidateDate < earliest) earliest = candidateDate;
  }
  const lookbackStart = new Date(earliest);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 2);

  const { data: postedRows, error: postedRowsError } = await adminClient
    .from("transactions")
    .select("id, posted_at, authorized_at, amount, merchant_canonical, merchant_normalized, description_short")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_deleted", false)
    .eq("is_pending", false)
    .gte("posted_at", lookbackStart.toISOString())
    .order("posted_at", { ascending: true })
    .limit(8000);

  if (postedRowsError) {
    throw new HttpError(500, "Could not read posted transactions for pending reconciliation.");
  }

  const posted = (postedRows ?? []) as TransactionMatchRow[];
  if (posted.length === 0) return 0;

  const matchedPendingIds = findPendingMatches(candidates, posted);
  if (matchedPendingIds.length === 0) return 0;

  const batchSize = 500;
  for (let i = 0; i < matchedPendingIds.length; i += batchSize) {
    const batch = matchedPendingIds.slice(i, i + batchSize);
    const { error: cleanupError } = await adminClient
      .from("transactions")
      .update({ is_deleted: true })
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("is_deleted", false)
      .eq("is_pending", true)
      .in("id", batch);

    if (cleanupError) {
      throw new HttpError(500, "Could not archive stale pending transactions.");
    }
  }

  return matchedPendingIds.length;
}

export async function forceArchivePendingTransactions(
  adminClient: AdminClient,
  userId: string,
  accountId: string,
  olderThanDays: number,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);

  const { data, error } = await adminClient
    .from("transactions")
    .update({ is_deleted: true })
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_deleted", false)
    .eq("is_pending", true)
    .lte("posted_at", cutoff.toISOString())
    .select("id");

  if (error) {
    throw new HttpError(500, "Could not force-archive pending transactions.");
  }

  return (data ?? []).length;
}
