export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly" | "unknown";

export type RecurringCharge = {
  day: string;
  absAmount: number;
};

type CadenceWindow = {
  cadence: Exclude<Cadence, "unknown">;
  min: number;
  max: number;
  minOccurrences: number;
};

const WINDOWS: CadenceWindow[] = [
  { cadence: "weekly", min: 5, max: 9, minOccurrences: 3 },
  { cadence: "monthly", min: 25, max: 35, minOccurrences: 2 },
  { cadence: "quarterly", min: 83, max: 97, minOccurrences: 2 },
  { cadence: "yearly", min: 351, max: 379, minOccurrences: 2 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function parseDay(day: string): Date {
  const [year, month, date] = day.split("-").map((token) => Number.parseInt(token, 10));
  return new Date(Date.UTC(year, month - 1, date));
}

function daysBetween(a: string, b: string): number {
  const ms = parseDay(b).getTime() - parseDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function dedupeByDay(charges: RecurringCharge[], centerAmount: number): RecurringCharge[] {
  const byDay = new Map<string, RecurringCharge>();
  for (const charge of charges) {
    const existing = byDay.get(charge.day);
    if (!existing) {
      byDay.set(charge.day, charge);
      continue;
    }

    const existingDistance = Math.abs(existing.absAmount - centerAmount);
    const nextDistance = Math.abs(charge.absAmount - centerAmount);
    if (nextDistance < existingDistance) {
      byDay.set(charge.day, charge);
    }
  }

  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

function cadenceFromMedianDelta(
  medianDelta: number,
  allowedCadences: Set<Cadence>,
): CadenceWindow | null {
  for (const window of WINDOWS) {
    if (!allowedCadences.has(window.cadence)) continue;
    if (medianDelta >= window.min && medianDelta <= window.max) return window;
  }
  return null;
}

export type RecurringDetection = {
  cadence: Exclude<Cadence, "unknown">;
  confidence: number;
  occurrences: number;
  filteredCharges: RecurringCharge[];
  medianDelta: number;
  stddevDelta: number;
  medianAbsAmount: number;
  stddevAbsAmount: number;
};

export function detectRecurringPattern(
  charges: RecurringCharge[],
  allowedCadences: Cadence[] = ["weekly", "monthly", "quarterly", "yearly"],
): RecurringDetection | null {
  if (charges.length < 2) return null;

  const sorted = [...charges].sort((a, b) => (a.day < b.day ? -1 : 1));
  const medianAbsAmount = median(sorted.map((charge) => charge.absAmount));
  const tolerance = Math.max(2, medianAbsAmount * 0.1);

  const filtered = dedupeByDay(
    sorted.filter((charge) => Math.abs(charge.absAmount - medianAbsAmount) <= tolerance),
    medianAbsAmount,
  );

  if (filtered.length < 2) return null;

  const deltas: number[] = [];
  for (let i = 1; i < filtered.length; i += 1) {
    deltas.push(daysBetween(filtered[i - 1].day, filtered[i].day));
  }
  if (deltas.length === 0) return null;

  const medianDelta = median(deltas);
  const cadenceWindow = cadenceFromMedianDelta(medianDelta, new Set<Cadence>(allowedCadences));
  if (!cadenceWindow) return null;
  if (filtered.length < cadenceWindow.minOccurrences) return null;

  const absAmounts = filtered.map((charge) => charge.absAmount);
  const stddevDelta = stddev(deltas);
  const stddevAbsAmount = stddev(absAmounts);

  const base = Math.min(filtered.length / 6, 1);
  const deltaScore = medianDelta > 0 ? 1 - clamp(stddevDelta / medianDelta, 0, 1) : 0;
  const amountScore = medianAbsAmount > 0 ? 1 - clamp(stddevAbsAmount / medianAbsAmount, 0, 1) : 0;
  const confidence = clamp(0.15 + 0.45 * base + 0.25 * deltaScore + 0.15 * amountScore, 0, 1);

  return {
    cadence: cadenceWindow.cadence,
    confidence,
    occurrences: filtered.length,
    filteredCharges: filtered,
    medianDelta,
    stddevDelta,
    medianAbsAmount,
    stddevAbsAmount,
  };
}
