import { describe, expect, it } from "vitest";
import { buildBackfillWindowsExclusive } from "./simplefin_backfill";

const DAY_SECONDS = 24 * 60 * 60;

describe("buildBackfillWindowsExclusive", () => {
  it("builds contiguous windows with no gaps or overlaps", () => {
    const now = new Date("2026-03-11T08:30:00.000Z");
    const windows = buildBackfillWindowsExclusive(6, now);

    expect(windows.length).toBeGreaterThan(0);
    for (let i = 1; i < windows.length; i += 1) {
      expect(windows[i].startDate).toBe(windows[i - 1].endDate);
    }
  });

  it("keeps each window at or under 60 days", () => {
    const now = new Date("2026-03-11T08:30:00.000Z");
    const windows = buildBackfillWindowsExclusive(24, now);

    for (const window of windows) {
      expect(window.endDate - window.startDate).toBeLessThanOrEqual(60 * DAY_SECONDS);
    }
  });

  it("ends exactly at endExclusive (tomorrow)", () => {
    const now = new Date("2026-03-11T08:30:00.000Z");
    const windows = buildBackfillWindowsExclusive(6, now);

    const expectedEndExclusive = Math.floor(new Date("2026-03-12T08:30:00.000Z").getTime() / 1000);
    expect(windows[windows.length - 1].endDate).toBe(expectedEndExclusive);
  });

  it("terminates quickly even for large ranges", () => {
    const now = new Date("2026-03-11T08:30:00.000Z");
    const windows = buildBackfillWindowsExclusive(240, now);

    expect(windows.length).toBeLessThan(130);
  });
});
