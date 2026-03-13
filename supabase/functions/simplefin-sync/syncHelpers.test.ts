import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  normalizeCanonicalMerchant,
  normalizeMerchantForSearch,
  toUnixSeconds,
  truncate,
} from "./syncHelpers.ts";

describe("syncHelpers", () => {
  it("normalizes merchant text for search", () => {
    expect(normalizeMerchantForSearch("POS STARBUCKS 1234 LLC")).toBe("starbucks");
  });

  it("returns null when canonical merchant normalization yields unknown", () => {
    expect(normalizeCanonicalMerchant("")).toBeNull();
  });

  it("supports date and string helpers", () => {
    const date = new Date("2026-03-12T00:00:00.000Z");

    expect(toUnixSeconds(date)).toBe(1773273600);
    expect(addCalendarDays(date, 2).toISOString()).toBe("2026-03-14T00:00:00.000Z");
    expect(truncate("abcdef", 4)).toBe("abcd");
  });
});
