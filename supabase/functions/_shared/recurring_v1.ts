export type RecurringCadenceV1 = "weekly" | "monthly" | "quarterly" | "yearly";

export type RecurringTxnInputV1 = {
  merchantCanonical: string | null;
  postedAt: string;
  amount: number;
  isDeleted?: boolean;
};

export type RecurringCandidateV1 = {
  merchantCanonical: string;
  cadence: RecurringCadenceV1;
  occurrences: number;
  confidence: number;
  averageAmount: number;
  lastChargeAt: string;
  nextExpectedAt: string;
};

type CadenceWindow = {
  cadence: RecurringCadenceV1;
  minDays: number;
  maxDays: number;
  minOccurrences: number;
};

const CADENCE_WINDOWS: CadenceWindow[] = [
  { cadence: "weekly", minDays: 5, maxDays: 9, minOccurrences: 3 },
  { cadence: "monthly", minDays: 25, maxDays: 35, minOccurrences: 2 },
  { cadence: "quarterly", minDays: 83, maxDays: 97, minOccurrences: 2 },
  { cadence: "yearly", minDays: 351, maxDays: 379, minOccurrences: 2 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeMerchant(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDay(iso: string): Date {
  return new Date(iso.slice(0, 10) + "T00:00:00.000Z");
}

function dayDiff(aIso: string, bIso: string): number {
  const ms = parseDay(bIso).getTime() - parseDay(aIso).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function addInterval(dayIso: string, cadence: RecurringCadenceV1): string {
  const date = parseDay(dayIso);
  if (cadence === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (cadence === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  if (cadence === "quarterly") date.setUTCMonth(date.getUTCMonth() + 3);
  if (cadence === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function pickCadence(deltas: number[], occurrences: number): CadenceWindow | null {
  const med = median(deltas);
  for (const window of CADENCE_WINDOWS) {
    if (occurrences < window.minOccurrences) continue;
    if (med >= window.minDays && med <= window.maxDays) return window;
  }
  return null;
}

export function detectRecurringCandidatesV1(
  transactions: RecurringTxnInputV1[],
): RecurringCandidateV1[] {
  const grouped = new Map<string, Array<{ day: string; absAmount: number }>>();

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    if (tx.amount >= 0) continue;
    if (!tx.merchantCanonical) continue;

    const merchant = normalizeMerchant(tx.merchantCanonical);
    if (!merchant) continue;

    const existing = grouped.get(merchant) ?? [];
    existing.push({
      day: tx.postedAt.slice(0, 10),
      absAmount: Math.abs(tx.amount),
    });
    grouped.set(merchant, existing);
  }

  const candidates: RecurringCandidateV1[] = [];

  for (const [merchant, charges] of grouped.entries()) {
    const ordered = [...charges].sort((a, b) => a.day.localeCompare(b.day));
    if (ordered.length < 2) continue;

    const deltas: number[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      deltas.push(dayDiff(ordered[i - 1].day, ordered[i].day));
    }
    if (deltas.length === 0) continue;

    const cadenceWindow = pickCadence(deltas, ordered.length);
    if (!cadenceWindow) continue;

    const amounts = ordered.map((charge) => charge.absAmount);
    const base = Math.min(ordered.length / 6, 1);
    const deltaScore = 1 - clamp(stddev(deltas) / Math.max(median(deltas), 1), 0, 1);
    const amountScore = 1 - clamp(stddev(amounts) / Math.max(median(amounts), 1), 0, 1);
    const confidence = clamp(0.2 + 0.5 * base + 0.2 * deltaScore + 0.1 * amountScore, 0, 1);

    const last = ordered[ordered.length - 1];
    candidates.push({
      merchantCanonical: merchant,
      cadence: cadenceWindow.cadence,
      occurrences: ordered.length,
      confidence: round2(confidence),
      averageAmount: round2(amounts.reduce((sum, value) => sum + value, 0) / amounts.length),
      lastChargeAt: last.day,
      nextExpectedAt: addInterval(last.day, cadenceWindow.cadence),
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
