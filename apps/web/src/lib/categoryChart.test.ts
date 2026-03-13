import { describe, expect, it } from "vitest";
import { buildBarCategoryRows, buildDonutCategoryRows, type CategorySpendRow } from "./categoryChart";

function sampleRows(count: number): CategorySpendRow[] {
  return Array.from({ length: count }, (_, index) => ({
    category: `Category ${index + 1}`,
    amount: 100 - index,
  }));
}

describe("category chart helpers", () => {
  it("buildDonutCategoryRows keeps top 5 and rolls remaining into Other", () => {
    const rows = sampleRows(8);
    const result = buildDonutCategoryRows(rows);

    expect(result).toHaveLength(6);
    expect(result.slice(0, 5)).toEqual(rows.slice(0, 5));
    expect(result[5]).toEqual({
      category: "Other",
      amount: rows.slice(5).reduce((sum, row) => sum + row.amount, 0),
    });
  });

  it("buildBarCategoryRows keeps top 10 and rolls remaining into Other", () => {
    const rows = sampleRows(14);
    const result = buildBarCategoryRows(rows);

    expect(result).toHaveLength(11);
    expect(result.slice(0, 10)).toEqual(rows.slice(0, 10));
    expect(result[10]).toEqual({
      category: "Other",
      amount: rows.slice(10).reduce((sum, row) => sum + row.amount, 0),
    });
  });
});
