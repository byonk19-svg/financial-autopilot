import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
} from 'date-fns'
import type {
  CashFlowBillTemplate,
  CashFlowLedgerDay,
  CashFlowLedgerEntry,
  CashFlowProjectedIncome,
  CashFlowTransaction,
} from './types'

type BuildMonthLedgerInput = {
  month: Date
  openingBalance: number
  lowBalanceThreshold: number
  transactions: CashFlowTransaction[]
  billTemplates: CashFlowBillTemplate[]
  projectedIncomes: CashFlowProjectedIncome[]
}

function toDateKey(input: string): string {
  const date = new Date(input)
  if (!Number.isNaN(date.valueOf())) return date.toISOString().slice(0, 10)
  return input.slice(0, 10)
}

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function clampDueDay(year: number, monthIndex: number, dueDay: number): number {
  const maxDay = getDaysInMonth(new Date(year, monthIndex, 1))
  return Math.min(Math.max(dueDay, 1), maxDay)
}

function toDayValue(dateKey: string): number {
  return parseISO(`${dateKey}T00:00:00`).valueOf()
}

export function getBillsForMonth(billTemplates: CashFlowBillTemplate[], month: Date): CashFlowLedgerEntry[] {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  return billTemplates
    .filter((template) => template.is_active)
    .map((template) => {
      const dueDay = clampDueDay(year, monthIndex, template.due_day_of_month)
      const dueDate = format(new Date(year, monthIndex, dueDay), 'yyyy-MM-dd')
      return {
        id: `bill-${template.id}-${format(month, 'yyyy-MM')}`,
        date: dueDate,
        amount: Number(template.amount ?? 0),
        description: template.name,
        category: template.category ?? 'bill',
        isProjected: true,
        billTemplateId: template.id,
        color: template.color ?? '#DC2626',
      } satisfies CashFlowLedgerEntry
    })
    .sort((a, b) => toDayValue(a.date) - toDayValue(b.date))
}

export function buildMonthLedger({
  month,
  openingBalance,
  lowBalanceThreshold,
  transactions,
  billTemplates,
  projectedIncomes,
}: BuildMonthLedgerInput): CashFlowLedgerDay[] {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const todayKey = format(new Date(), 'yyyy-MM-dd')

  const projectedBills = getBillsForMonth(billTemplates, month)
  const projectedIncomeEntries: CashFlowLedgerEntry[] = projectedIncomes
    .filter((income) => income.is_active)
    .map((income) => ({
      id: income.id,
      date: income.expected_date,
      amount: Number(income.amount ?? 0),
      description: income.description,
      category: 'income',
      isProjected: true,
      employerId: income.employer_id,
      color: '#16A34A',
    }))

  const realEntries: CashFlowLedgerEntry[] = transactions.map((transaction) => ({
    id: transaction.id,
    date: toDateKey(transaction.posted_at),
    amount: Number(transaction.amount ?? 0),
    description:
      transaction.description_short ||
      transaction.merchant_canonical ||
      transaction.merchant_normalized ||
      'Transaction',
    category: Number(transaction.amount ?? 0) >= 0 ? 'income' : 'expense',
    isProjected: false,
    billTemplateId: null,
    color: null,
  }))

  const realTemplateKeys = new Set(
    realEntries.map((entry) => `${entry.date}|${normalizeKey(entry.description)}`),
  )
  const entriesByDate: Record<string, CashFlowLedgerEntry[]> = {}

  for (const entry of [...realEntries, ...projectedBills, ...projectedIncomeEntries]) {
    if (entry.isProjected && entry.billTemplateId) {
      const projectedKey = `${entry.date}|${normalizeKey(entry.description)}`
      if (realTemplateKeys.has(projectedKey)) continue
    }

    if (!entriesByDate[entry.date]) entriesByDate[entry.date] = []
    entriesByDate[entry.date].push(entry)
  }

  let runningBalance = openingBalance

  return days.map((day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const entries = entriesByDate[dateKey] ?? []
    const dayTotal = entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0)
    const isToday = dateKey === todayKey
    const isPast = dateKey < todayKey
    runningBalance += dayTotal

    return {
      date: dateKey,
      entries,
      dayTotal: Math.round(dayTotal * 100) / 100,
      runningBalance: Math.round(runningBalance * 100) / 100,
      isProjected: !isPast,
      isToday,
      isBelowThreshold: runningBalance < lowBalanceThreshold,
    } satisfies CashFlowLedgerDay
  })
}

export function findUpcomingLowPoints(
  ledger: CashFlowLedgerDay[],
  threshold: number,
): Array<{ date: string; balance: number; triggeredBy: string[] }> {
  const todayKey = format(new Date(), 'yyyy-MM-dd')

  return ledger
    .filter((day) => day.date >= todayKey && day.runningBalance < threshold)
    .map((day) => ({
      date: day.date,
      balance: day.runningBalance,
      triggeredBy: day.entries
        .filter((entry) => Number(entry.amount) < 0)
        .map((entry) => entry.description),
    }))
}
