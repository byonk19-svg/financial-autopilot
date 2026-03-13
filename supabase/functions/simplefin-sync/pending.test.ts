import { describe, expect, it } from "vitest";
import { findPendingMatches } from "./pending.ts";

describe("findPendingMatches", () => {
  it("matches pending transactions to posted transactions by amount, date, and merchant", () => {
    const pending = [
      {
        id: "pending-1",
        posted_at: "2026-03-01T00:00:00.000Z",
        authorized_at: null,
        amount: "-12.34",
        merchant_canonical: "STARBUCKS",
        merchant_normalized: "starbucks",
        description_short: "Starbucks 1234",
      },
    ];

    const posted = [
      {
        id: "posted-1",
        posted_at: "2026-03-03T00:00:00.000Z",
        authorized_at: null,
        amount: "-12.34",
        merchant_canonical: "STARBUCKS STORE",
        merchant_normalized: "starbucks store",
        description_short: "Starbucks Store 1234",
      },
    ];

    expect(findPendingMatches(pending, posted)).toEqual(["pending-1"]);
  });

  it("does not reuse the same posted transaction for multiple pending rows", () => {
    const posted = [
      {
        id: "posted-1",
        posted_at: "2026-03-03T00:00:00.000Z",
        authorized_at: null,
        amount: "-25.00",
        merchant_canonical: "TARGET",
        merchant_normalized: "target",
        description_short: "Target",
      },
    ];

    const pending = [
      {
        id: "pending-1",
        posted_at: "2026-03-02T00:00:00.000Z",
        authorized_at: null,
        amount: "-25.00",
        merchant_canonical: "TARGET",
        merchant_normalized: "target",
        description_short: "Target",
      },
      {
        id: "pending-2",
        posted_at: "2026-03-02T00:00:00.000Z",
        authorized_at: null,
        amount: "-25.00",
        merchant_canonical: "TARGET",
        merchant_normalized: "target",
        description_short: "Target",
      },
    ];

    expect(findPendingMatches(pending, posted)).toEqual(["pending-1"]);
  });
});
