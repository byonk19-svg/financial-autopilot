import { describe, expect, it } from "vitest";
import {
  emptySyncRequestOptions,
  parseSyncRequestOptionsBody,
} from "./simplefin_sync_options";

describe("parseSyncRequestOptionsBody", () => {
  it("returns empty options when body is not a plain object", () => {
    expect(parseSyncRequestOptionsBody(null)).toEqual(emptySyncRequestOptions());
    expect(parseSyncRequestOptionsBody("x")).toEqual(emptySyncRequestOptions());
    expect(parseSyncRequestOptionsBody([])).toEqual(emptySyncRequestOptions());
  });

  it("parses numeric and string values as truncated integers", () => {
    const result = parseSyncRequestOptionsBody({
      force_archive_pending_days: "30",
      lookback_days: 59.9,
      backfill_months: "12",
    });

    expect(result).toEqual({
      forceArchivePendingDays: 30,
      lookbackDays: 59,
      backfillMonths: 12,
    });
  });

  it("treats non-numeric option values as null", () => {
    const result = parseSyncRequestOptionsBody({
      force_archive_pending_days: "abc",
      lookback_days: {},
      backfill_months: "",
    });

    expect(result).toEqual(emptySyncRequestOptions());
  });

  it("throws for out-of-range values", () => {
    expect(() => parseSyncRequestOptionsBody({ force_archive_pending_days: 0 }))
      .toThrow("force_archive_pending_days must be 1..90.");
    expect(() => parseSyncRequestOptionsBody({ lookback_days: 61 }))
      .toThrow("lookback_days must be 1..60.");
    expect(() => parseSyncRequestOptionsBody({ backfill_months: 25 }))
      .toThrow("backfill_months must be 1..24.");
  });
});
