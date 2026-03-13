export const MAX_FORCE_ARCHIVE_PENDING_DAYS = 90;
export const DEFAULT_LOOKBACK_DAYS = 60;
export const MAX_LOOKBACK_DAYS = 60;
export const MAX_BACKFILL_MONTHS = 24;

export type SyncRequestOptions = {
  forceArchivePendingDays: number | null;
  lookbackDays: number | null;
  backfillMonths: number | null;
};

export function emptySyncRequestOptions(): SyncRequestOptions {
  return {
    forceArchivePendingDays: null,
    lookbackDays: null,
    backfillMonths: null,
  };
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

export function parseSyncRequestOptionsBody(body: unknown): SyncRequestOptions {
  const record = asRecord(body);
  if (!record) {
    return emptySyncRequestOptions();
  }

  const forceRaw = parseOptionalInt(record.force_archive_pending_days);
  const lookbackRaw = parseOptionalInt(record.lookback_days);
  const backfillRaw = parseOptionalInt(record.backfill_months);

  if (forceRaw !== null && (forceRaw < 1 || forceRaw > MAX_FORCE_ARCHIVE_PENDING_DAYS)) {
    throw new Error(`force_archive_pending_days must be 1..${MAX_FORCE_ARCHIVE_PENDING_DAYS}.`);
  }
  if (lookbackRaw !== null && (lookbackRaw < 1 || lookbackRaw > MAX_LOOKBACK_DAYS)) {
    throw new Error(`lookback_days must be 1..${MAX_LOOKBACK_DAYS}.`);
  }
  if (backfillRaw !== null && (backfillRaw < 1 || backfillRaw > MAX_BACKFILL_MONTHS)) {
    throw new Error(`backfill_months must be 1..${MAX_BACKFILL_MONTHS}.`);
  }

  return {
    forceArchivePendingDays: forceRaw,
    lookbackDays: lookbackRaw,
    backfillMonths: backfillRaw,
  };
}
