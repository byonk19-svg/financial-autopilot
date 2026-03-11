import { describe, expect, it } from "vitest";
import {
  buildBackfillWindows,
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
      lookback_days: 90.9,
      backfill_months: "12",
    });

    expect(result).toEqual({
      forceArchivePendingDays: 30,
      lookbackDays: 90,
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
    expect(() => parseSyncRequestOptionsBody({ lookback_days: 366 }))
      .toThrow("lookback_days must be 1..365.");
    expect(() => parseSyncRequestOptionsBody({ backfill_months: 25 }))
      .toThrow("backfill_months must be 1..24.");
  });
});

describe("buildBackfillWindows", () => {
  it("creates contiguous windows with no one-day gaps", () => {
    const now = new Date("2026-03-11T00:00:00.000Z");
    const windows = buildBackfillWindows(6, now);

    expect(windows.length).toBeGreaterThan(1);
    for (let i = 1; i < windows.length; i += 1) {
      expect(windows[i].startDate).toBe(windows[i - 1].endDate);
    }
  });
});
