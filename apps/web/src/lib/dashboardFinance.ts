import { format, startOfMonth, subMonths } from 'date-fns'
import { toNumber } from './subscriptionFormatters'

export type DashboardTrendSourceRow = {
  posted_at: string
  amount: number | string | null
  type: string | null
}

export type DashboardMonthlyTrendRow = {
  monthKey: string
  label: string
  income: number
  expense: number
  net: number
}

export type DashboardRecentTransactionSourceRow = {
  id: string
  posted_at: string
  amount: number | string | null
  type: string | null
  category: string | null
  description_short: string
  merchant_canonical: string | null
  merchant_normalized: string | null
  is_credit: boolean | null
}

export type DashboardRecentTransaction = {
  id: string
  postedAt: string
  label: string
  amount: number
  type: 'income' | 'expense'
  category: string | null
  isCredit: boolean
}

export type DashboardTopSpendCategory = {
  category: string
  amount: number
}

export type DashboardCreditSpendSummary = {
  total: number
  topCategories: DashboardTopSpendCategory[]
}

export function buildDashboardMonthlyTrendRows(
  rows: DashboardTrendSourceRow[],
  monthCount = 6,
  now = new Date(),
): DashboardMonthlyTrendRow[] {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const monthDate = startOfMonth(subMonths(now, monthCount - index - 1))
    return {
      monthDate,
      monthKey: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMM'),
    }
  })

  const buckets = new Map(
    months.map((month) => [
      month.monthKey,
      {
        monthKey: month.monthKey,
        label: month.label,
        income: 0,
        expense: 0,
        net: 0,
      } satisfies DashboardMonthlyTrendRow,
    ]),
  )

  for (const row of rows) {
    if (!row.posted_at || (row.type !== 'income' && row.type !== 'expense')) continue
    const date = new Date(row.posted_at)
    if (Number.isNaN(date.valueOf())) continue

    const monthKey = format(startOfMonth(date), 'yyyy-MM')
    const bucket = buckets.get(monthKey)
    if (!bucket) continue

    const amount = toNumber(row.amount)
    if (row.type === 'income') {
      bucket.income += Math.max(amount, 0)
    } else {
      bucket.expense += Math.abs(amount)
    }
  }

  return months.map((month) => {
    const bucket = buckets.get(month.monthKey)
    const income = round2(bucket?.income ?? 0)
    const expense = round2(bucket?.expense ?? 0)
    return {
      monthKey: month.monthKey,
      label: month.label,
      income,
      expense,
      net: round2(income - expense),
    }
  })
}

export function buildDashboardRecentTransactions(
  rows: DashboardRecentTransactionSourceRow[],
  limit = 6,
): DashboardRecentTransaction[] {
  return rows
    .filter((row): row is DashboardRecentTransactionSourceRow & { type: 'income' | 'expense' } =>
      row.type === 'income' || row.type === 'expense',
    )
    .sort((a, b) => (a.posted_at > b.posted_at ? -1 : 1))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      postedAt: row.posted_at,
      label:
        row.merchant_canonical?.trim() ||
        row.merchant_normalized?.trim() ||
        row.description_short.trim() ||
        'Transaction',
      amount: round2(toNumber(row.amount)),
      type: row.type,
      category: row.category?.trim() || null,
      isCredit: Boolean(row.is_credit),
    }))
}

export function buildDashboardCreditSpendSummary(
  rows: DashboardRecentTransactionSourceRow[],
  now = new Date(),
  limit = 5,
): DashboardCreditSpendSummary {
  const currentMonthKey = format(startOfMonth(now), 'yyyy-MM')
  const totals = new Map<string, number>()
  let total = 0

  for (const row of rows) {
    if (row.type !== 'expense' || !row.is_credit) continue
    const date = new Date(row.posted_at)
    if (Number.isNaN(date.valueOf())) continue
    if (format(startOfMonth(date), 'yyyy-MM') !== currentMonthKey) continue

    const category = row.category?.trim() || 'Uncategorized'
    const amount = Math.abs(toNumber(row.amount))
    total += amount
    totals.set(category, (totals.get(category) ?? 0) + amount)
  }

  return {
    total: round2(total),
    topCategories: [...totals.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => (b.amount === a.amount ? a.category.localeCompare(b.category) : b.amount - a.amount))
      .slice(0, limit),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
