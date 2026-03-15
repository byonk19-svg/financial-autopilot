import { format, getDaysInMonth, startOfMonth } from "date-fns";
import { describe, expect, it } from "vitest";
import { buildMonthLedger, findUpcomingLowPoints, getBillsForMonth } from "./cashFlowLedger";
import type {
  CashFlowBillTemplate,
  CashFlowLedgerDay,
  CashFlowProjectedIncome,
  CashFlowTransaction,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBill(overrides: Partial<CashFlowBillTemplate> = {}): CashFlowBillTemplate {
  return {
    id: "bill-1",
    user_id: "user-1",
    name: "Rent",
    amount: 1500,
    due_day_of_month: 1,
    account_id: null,
    category: "bill",
    color: "#DC2626",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeIncome(overrides: Partial<CashFlowProjectedIncome> = {}): CashFlowProjectedIncome {
  return {
    id: "income-1",
    user_id: "user-1",
    expected_date: "2099-01-15",
    amount: 3000,
    description: "Paycheck",
    employer_id: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTxn(overrides: Partial<CashFlowTransaction> = {}): CashFlowTransaction {
  return {
    id: "txn-1",
    posted_at: "2020-01-05T00:00:00Z",
    amount: -50,
    description_short: "Netflix",
    merchant_canonical: null,
    merchant_normalized: null,
    ...overrides,
  };
}

const PAST_MONTH = new Date(2020, 0, 1); // Jan 2020
const FUTURE_MONTH = new Date(2099, 0, 1); // Jan 2099

// ── getBillsForMonth ──────────────────────────────────────────────────────────

describe("getBillsForMonth", () => {
  it("returns empty array for no templates", () => {
    expect(getBillsForMonth([], PAST_MONTH)).toEqual([]);
  });

  it("filters out inactive templates", () => {
    const templates = [makeBill({ is_active: true }), makeBill({ id: "bill-2", is_active: false })];
    const result = getBillsForMonth(templates, PAST_MONTH);
    expect(result).toHaveLength(1);
    expect(result[0].billTemplateId).toBe("bill-1");
  });

  it("returns correct entry shape for an active template", () => {
    const templates = [makeBill({ due_day_of_month: 15, color: "#123456", category: "expense" })];
    const [entry] = getBillsForMonth(templates, PAST_MONTH);
    expect(entry).toMatchObject({
      id: "bill-bill-1-2020-01",
      date: "2020-01-15",
      amount: 1500,
      description: "Rent",
      category: "expense",
      isProjected: true,
      billTemplateId: "bill-1",
      color: "#123456",
    });
  });

  it("clamps due_day for February (day 31 → last day of month)", () => {
    const feb2020 = new Date(2020, 1, 1); // Feb 2020 (leap year: 29 days)
    const feb2021 = new Date(2021, 1, 1); // Feb 2021 (28 days)
    const template = makeBill({ due_day_of_month: 31 });

    const [leap] = getBillsForMonth([template], feb2020);
    expect(leap.date).toBe("2020-02-29");

    const [common] = getBillsForMonth([template], feb2021);
    expect(common.date).toBe("2021-02-28");
  });

  it("clamps due_day below 1 up to day 1", () => {
    const template = makeBill({ due_day_of_month: 0 });
    const [entry] = getBillsForMonth([template], PAST_MONTH);
    expect(entry.date).toBe("2020-01-01");
  });

  it("returns entries sorted by date", () => {
    const templates = [
      makeBill({ id: "bill-late", due_day_of_month: 28 }),
      makeBill({ id: "bill-early", due_day_of_month: 5 }),
      makeBill({ id: "bill-mid", due_day_of_month: 15 }),
    ];
    const result = getBillsForMonth(templates, PAST_MONTH);
    const dates = result.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("uses default color when template has no color", () => {
    const template = { ...makeBill(), color: undefined } as unknown as CashFlowBillTemplate;
    const [entry] = getBillsForMonth([template], PAST_MONTH);
    expect(entry.color).toBe("#DC2626");
  });

  it("uses default category 'bill' when template has no category", () => {
    const template = { ...makeBill(), category: undefined } as unknown as CashFlowBillTemplate;
    const [entry] = getBillsForMonth([template], PAST_MONTH);
    expect(entry.category).toBe("bill");
  });
});

// ── buildMonthLedger ──────────────────────────────────────────────────────────

describe("buildMonthLedger", () => {
  it("returns one entry per day in the month", () => {
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 0,
      lowBalanceThreshold: 500,
      transactions: [],
      billTemplates: [],
      projectedIncomes: [],
    });
    expect(result).toHaveLength(getDaysInMonth(PAST_MONTH));
    expect(result[0].date).toBe("2020-01-01");
    expect(result[result.length - 1].date).toBe("2020-01-31");
  });

  it("accumulates running balance correctly", () => {
    const transactions = [
      makeTxn({ id: "t1", posted_at: "2020-01-01T00:00:00Z", amount: 1000 }),
      makeTxn({ id: "t2", posted_at: "2020-01-02T00:00:00Z", amount: -200 }),
      makeTxn({ id: "t3", posted_at: "2020-01-02T00:00:00Z", amount: -50 }),
    ];
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 500,
      lowBalanceThreshold: 0,
      transactions,
      billTemplates: [],
      projectedIncomes: [],
    });
    expect(result[0].runningBalance).toBe(1500); // 500 + 1000
    expect(result[1].runningBalance).toBe(1250); // 1500 - 200 - 50
  });

  it("marks isBelowThreshold when running balance is below threshold", () => {
    const transactions = [makeTxn({ posted_at: "2020-01-05T00:00:00Z", amount: -800 })];
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 1000,
      lowBalanceThreshold: 500,
      transactions,
      billTemplates: [],
      projectedIncomes: [],
    });
    // Day 5: balance drops to 200 → below threshold
    const day5 = result.find((d) => d.date === "2020-01-05")!;
    expect(day5.isBelowThreshold).toBe(true);
    // Day 4: balance still 1000 → not below threshold
    const day4 = result.find((d) => d.date === "2020-01-04")!;
    expect(day4.isBelowThreshold).toBe(false);
  });

  it("deduplicates projected bill when matching real transaction exists on same day", () => {
    const transactions = [makeTxn({ posted_at: "2020-01-01T00:00:00Z", amount: -1500, description_short: "Rent" })];
    const bills = [makeBill({ due_day_of_month: 1, amount: 1500, name: "Rent" })];
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 2000,
      lowBalanceThreshold: 0,
      transactions,
      billTemplates: bills,
      projectedIncomes: [],
    });
    const day1 = result.find((d) => d.date === "2020-01-01")!;
    // Only the real transaction should appear, not both
    expect(day1.entries).toHaveLength(1);
    expect(day1.entries[0].isProjected).toBe(false);
  });

  it("deduplication is case/punctuation-insensitive for description matching", () => {
    const transactions = [
      makeTxn({ posted_at: "2020-01-01T00:00:00Z", amount: -1500, description_short: "RENT PAYMENT!" }),
    ];
    const bills = [makeBill({ due_day_of_month: 1, amount: 1500, name: "rent payment" })];
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 2000,
      lowBalanceThreshold: 0,
      transactions,
      billTemplates: bills,
      projectedIncomes: [],
    });
    const day1 = result.find((d) => d.date === "2020-01-01")!;
    expect(day1.entries).toHaveLength(1);
  });

  it("does not deduplicate projected bill when real transaction is on a different day", () => {
    // Real transaction on Jan 2, projected bill on Jan 1 → both should appear
    const transactions = [makeTxn({ id: "t1", posted_at: "2020-01-02T00:00:00Z", amount: -1500, description_short: "Rent" })];
    const bills = [makeBill({ due_day_of_month: 1, amount: 1500, name: "Rent" })];
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 2000,
      lowBalanceThreshold: 0,
      transactions,
      billTemplates: bills,
      projectedIncomes: [],
    });
    const day1 = result.find((d) => d.date === "2020-01-01")!;
    expect(day1.entries).toHaveLength(1);
    expect(day1.entries[0].isProjected).toBe(true);
  });

  it("excludes inactive projected incomes", () => {
    const incomes = [
      makeIncome({ id: "inc-1", expected_date: "2099-01-10", is_active: true }),
      makeIncome({ id: "inc-2", expected_date: "2099-01-20", is_active: false }),
    ];
    const result = buildMonthLedger({
      month: FUTURE_MONTH,
      openingBalance: 0,
      lowBalanceThreshold: 0,
      transactions: [],
      billTemplates: [],
      projectedIncomes: incomes,
    });
    const day10 = result.find((d) => d.date === "2099-01-10")!;
    const day20 = result.find((d) => d.date === "2099-01-20")!;
    expect(day10.entries).toHaveLength(1); // active income
    expect(day20.entries).toHaveLength(0); // inactive income excluded
  });

  it("marks all days in a past month as isProjected=false", () => {
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 0,
      lowBalanceThreshold: 0,
      transactions: [],
      billTemplates: [],
      projectedIncomes: [],
    });
    expect(result.every((d) => d.isProjected === false)).toBe(true);
  });

  it("marks all days in a far-future month as isProjected=true", () => {
    const result = buildMonthLedger({
      month: FUTURE_MONTH,
      openingBalance: 0,
      lowBalanceThreshold: 0,
      transactions: [],
      billTemplates: [],
      projectedIncomes: [],
    });
    expect(result.every((d) => d.isProjected === true)).toBe(true);
  });

  it("marks exactly today's date as isToday=true", () => {
    const today = new Date();
    const thisMonth = startOfMonth(today);
    const result = buildMonthLedger({
      month: thisMonth,
      openingBalance: 0,
      lowBalanceThreshold: 0,
      transactions: [],
      billTemplates: [],
      projectedIncomes: [],
    });
    const todayKey = format(today, "yyyy-MM-dd");
    const todayDays = result.filter((d) => d.isToday);
    expect(todayDays).toHaveLength(1);
    expect(todayDays[0].date).toBe(todayKey);
  });

  it("rounds dayTotal and runningBalance to 2 decimal places", () => {
    const transactions = [makeTxn({ amount: -33.333, posted_at: "2020-01-01T00:00:00Z" })];
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 100,
      lowBalanceThreshold: 0,
      transactions,
      billTemplates: [],
      projectedIncomes: [],
    });
    const day1 = result[0];
    // dayTotal: -33.33, runningBalance: 66.67
    expect(day1.dayTotal).toBe(-33.33);
    expect(day1.runningBalance).toBe(66.67);
  });

  it("falls back to merchant_canonical then merchant_normalized for transaction description", () => {
    const txn1 = makeTxn({ id: "txn-1", description_short: "", merchant_canonical: "NETFLIX", merchant_normalized: "netflix", posted_at: "2020-01-05T00:00:00Z" });
    const txn2 = makeTxn({
      id: "txn-2",
      description_short: "",
      merchant_canonical: null,
      merchant_normalized: "spotify",
      posted_at: "2020-01-10T00:00:00Z",
    });
    const txn3 = makeTxn({
      id: "txn-3",
      description_short: "",
      merchant_canonical: null,
      merchant_normalized: null,
      posted_at: "2020-01-15T00:00:00Z",
    });
    const result = buildMonthLedger({
      month: PAST_MONTH,
      openingBalance: 0,
      lowBalanceThreshold: 0,
      transactions: [txn1, txn2, txn3],
      billTemplates: [],
      projectedIncomes: [],
    });
    expect(result.find((d) => d.date === "2020-01-05")!.entries[0].description).toBe("NETFLIX");
    expect(result.find((d) => d.date === "2020-01-10")!.entries[0].description).toBe("spotify");
    expect(result.find((d) => d.date === "2020-01-15")!.entries[0].description).toBe("Transaction");
  });
});

// ── findUpcomingLowPoints ─────────────────────────────────────────────────────

describe("findUpcomingLowPoints", () => {
  function makeLedgerDay(
    date: string,
    runningBalance: number,
    entries: CashFlowLedgerDay["entries"] = [],
  ): CashFlowLedgerDay {
    return {
      date,
      runningBalance,
      entries,
      dayTotal: 0,
      isProjected: true,
      isToday: false,
      isBelowThreshold: runningBalance < 500,
    };
  }

  it("returns empty array when no days are below threshold", () => {
    const ledger = [
      makeLedgerDay("2099-01-01", 1000),
      makeLedgerDay("2099-01-02", 900),
    ];
    expect(findUpcomingLowPoints(ledger, 500)).toEqual([]);
  });

  it("excludes past days even when their balance is below threshold", () => {
    const pastDate = "2020-01-01";
    const ledger = [makeLedgerDay(pastDate, 100)];
    expect(findUpcomingLowPoints(ledger, 500)).toEqual([]);
  });

  it("includes future days where running balance is below threshold", () => {
    const ledger = [
      makeLedgerDay("2099-01-10", 400, [
        { id: "e1", date: "2099-01-10", amount: -600, description: "Big Bill", category: "bill", isProjected: true },
      ]),
    ];
    const result = findUpcomingLowPoints(ledger, 500);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2099-01-10");
    expect(result[0].balance).toBe(400);
  });

  it("triggeredBy contains descriptions of negative-amount entries only", () => {
    const entries: CashFlowLedgerDay["entries"] = [
      { id: "e1", date: "2099-01-10", amount: -600, description: "Rent", category: "bill", isProjected: true },
      { id: "e2", date: "2099-01-10", amount: -200, description: "Electric", category: "bill", isProjected: true },
      { id: "e3", date: "2099-01-10", amount: 100, description: "Refund", category: "income", isProjected: true },
    ];
    const ledger = [makeLedgerDay("2099-01-10", 200, entries)];
    const result = findUpcomingLowPoints(ledger, 500);
    expect(result[0].triggeredBy).toEqual(["Rent", "Electric"]);
    expect(result[0].triggeredBy).not.toContain("Refund");
  });

  it("returns multiple low-point days when several qualify", () => {
    const ledger = [
      makeLedgerDay("2099-01-10", 400),
      makeLedgerDay("2099-01-11", 600), // above threshold
      makeLedgerDay("2099-01-12", 300),
    ];
    const result = findUpcomingLowPoints(ledger, 500);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.date)).toEqual(["2099-01-10", "2099-01-12"]);
  });

  it("includes today's date in upcoming low points", () => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const ledger = [makeLedgerDay(todayKey, 100)];
    const result = findUpcomingLowPoints(ledger, 500);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe(todayKey);
  });
});
