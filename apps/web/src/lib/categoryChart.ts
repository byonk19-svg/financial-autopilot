export type CategorySpendRow = {
  category: string;
  amount: number;
};

function buildTopWithOther(rows: CategorySpendRow[], topN: number): CategorySpendRow[] {
  if (rows.length <= topN) return rows;

  const topRows = rows.slice(0, topN);
  const otherAmount = rows.slice(topN).reduce((sum, row) => sum + row.amount, 0);
  if (otherAmount <= 0) return topRows;

  return [...topRows, { category: "Other", amount: otherAmount }];
}

export function buildDonutCategoryRows(rows: CategorySpendRow[]): CategorySpendRow[] {
  return buildTopWithOther(rows, 5);
}

export function buildBarCategoryRows(rows: CategorySpendRow[]): CategorySpendRow[] {
  return buildTopWithOther(rows, 10);
}
