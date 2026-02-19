import { describe, expect, it } from "vitest";
import { detectRecurringCandidatesV1 } from "./recurring_v1";

describe("detectRecurringCandidatesV1", () => {
  it("detects monthly recurring expenses", () => {
    const candidates = detectRecurringCandidatesV1([
      { merchantCanonical: "NETFLIX", postedAt: "2026-01-05T12:00:00Z", amount: -19.99 },
      { merchantCanonical: "NETFLIX", postedAt: "2026-02-05T12:00:00Z", amount: -19.99 },
      { merchantCanonical: "NETFLIX", postedAt: "2026-03-06T12:00:00Z", amount: -20.49 },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].merchantCanonical).toBe("NETFLIX");
    expect(candidates[0].cadence).toBe("monthly");
    expect(candidates[0].occurrences).toBe(3);
  });

  it("ignores positive and deleted transactions", () => {
    const candidates = detectRecurringCandidatesV1([
      { merchantCanonical: "PAYROLL", postedAt: "2026-01-01T12:00:00Z", amount: 2000 },
      { merchantCanonical: "PAYROLL", postedAt: "2026-01-08T12:00:00Z", amount: 2000, isDeleted: true },
      { merchantCanonical: "PAYROLL", postedAt: "2026-01-15T12:00:00Z", amount: 2000 },
    ]);

    expect(candidates).toHaveLength(0);
  });
});
