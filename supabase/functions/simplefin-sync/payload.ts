export function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

export function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function toIsoDate(value: unknown, fallbackIso: string): string {
  const minimumReasonableYear = 2000;

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number.parseFloat(trimmed);
      return toIsoDate(numeric, fallbackIso);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf()) && parsed.getUTCFullYear() >= minimumReasonableYear) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) {
      return fallbackIso;
    }
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.valueOf()) && parsed.getUTCFullYear() >= minimumReasonableYear) {
      return parsed.toISOString();
    }
  }

  return fallbackIso;
}

export function addDays(isoDate: string, days: number): string {
  const parsed = new Date(isoDate);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString();
}

export function parseAccountsPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> =>
      item !== null
    );
  }

  const payloadObject = asRecord(payload);
  if (!payloadObject) {
    return [];
  }

  const nestedAccounts = payloadObject.accounts;
  if (Array.isArray(nestedAccounts)) {
    return nestedAccounts
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  return [];
}

export function parseTransactions(accountObject: Record<string, unknown>): Record<string, unknown>[] {
  const transactions = accountObject.transactions;
  if (!Array.isArray(transactions)) {
    return [];
  }

  return transactions
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}
