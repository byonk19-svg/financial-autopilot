import { endOfMonth, format } from 'date-fns'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMonthLedger, findUpcomingLowPoints, getBillsForMonth } from './cashFlowLedger'
import { buildDashboardPlannerSummary } from './dashboardPlanner'
import type {
  CashFlowBillTemplate,
  CashFlowLedgerDay,
  CashFlowProjectedIncome,
  CashFlowTransaction,
} from './types'

function makeBill(overrides: Partial<CashFlowBillTemplate> = {}): CashFlowBillTemplate {
  return {
    id: 'bill-1',
    user_id: 'user-1',
    name: 'Rent',
    amount: -900,
    due_day_of_month: 12,
    account_id: null,
    category: 'bill',
    color: '#dc2626',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeIncome(overrides: Partial<CashFlowProjectedIncome> = {}): CashFlowProjectedIncome {
  return {
    id: 'income-1',
    user_id: 'user-1',
    expected_date: '2026-03-15',
    amount: 1500,
    description: 'Main paycheck',
    employer_id: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeTxn(overrides: Partial<CashFlowTransaction> = {}): CashFlowTransaction {
  return {
    id: 'txn-1',
    posted_at: '2026-03-05T12:00:00Z',
    amount: -55,
    description_short: 'Groceries',
    merchant_canonical: null,
    merchant_normalized: null,
    ...overrides,
  }
}

function summarizeLedger(ledger: CashFlowLedgerDay[], openingBalance: number) {
  const entries = ledger.flatMap((day) => day.entries)
  const incomeTotal = entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0)
  const expenseTotal = entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
  const lowestDay = ledger.reduce<CashFlowLedgerDay | null>((lowest, day) => {
    if (!lowest || day.runningBalance < lowest.runningBalance) return day
    return lowest
  }, null)

  return {
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    projectedIncome: entries
      .filter((entry) => entry.isProjected && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0),
    projectedExpense: entries
      .filter((entry) => entry.isProjected && entry.amount < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0),
    lowestBalance: lowestDay?.runningBalance ?? openingBalance,
    lowestBalanceDate: lowestDay?.date ?? null,
  }
}

describe('buildDashboardPlannerSummary', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a safe runway summary with next paycheck, next bill, and safe-to-spend buffer', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'))

    const monthDate = new Date(2026, 2, 1)
    const openingBalance = 2000
    const lowBalanceThreshold = 500
    const projectedIncomes = [makeIncome()]
    const billTemplates = [makeBill()]
    const ledger = buildMonthLedger({
      month: monthDate,
      openingBalance,
      lowBalanceThreshold,
      transactions: [],
      billTemplates,
      projectedIncomes,
    })

    const summary = buildDashboardPlannerSummary({
      monthDate,
      openingBalance,
      lowBalanceThreshold,
      ledger,
      billsThisMonth: getBillsForMonth(billTemplates, monthDate),
      projectedIncomes,
      summary: summarizeLedger(ledger, openingBalance),
      lowPoints: findUpcomingLowPoints(ledger, lowBalanceThreshold),
      now: new Date('2026-03-10T12:00:00Z'),
    })

    expect(summary.lowestBalance).toBe(1100)
    expect(summary.lowestBalanceDate).toBe('2026-03-12')
    expect(summary.nextPaycheck).toMatchObject({
      date: '2026-03-15',
      amount: 1500,
      description: 'Main paycheck',
    })
    expect(summary.nextBill).toMatchObject({
      date: '2026-03-12',
      amount: 900,
      description: 'Rent',
    })
    expect(summary.billsDueSoonCount).toBe(1)
    expect(summary.billsDueSoonTotal).toBe(900)
    expect(summary.safeToSpend).toBe(600)
    expect(summary.focusWindowLabel).toBe('until next paycheck')
    expect(summary.narrative.tone).toBe('safe')
    expect(summary.semanticSummary).toContain('Lowest projected balance is $1,100.00 on Mar 12.')
    expect(summary.semanticSummary).toContain('Safe to spend before the next paycheck is $600.00.')
  })

  it('builds a tight verdict when the ledger stays positive but dips under the comfort floor', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'))

    const monthDate = new Date(2026, 2, 1)
    const openingBalance = 700
    const lowBalanceThreshold = 500
    const projectedIncomes = [makeIncome()]
    const billTemplates = [makeBill({ amount: -300, name: 'Utilities' })]
    const ledger = buildMonthLedger({
      month: monthDate,
      openingBalance,
      lowBalanceThreshold,
      transactions: [],
      billTemplates,
      projectedIncomes,
    })

    const summary = buildDashboardPlannerSummary({
      monthDate,
      openingBalance,
      lowBalanceThreshold,
      ledger,
      billsThisMonth: getBillsForMonth(billTemplates, monthDate),
      projectedIncomes,
      summary: summarizeLedger(ledger, openingBalance),
      lowPoints: findUpcomingLowPoints(ledger, lowBalanceThreshold),
      now: new Date('2026-03-10T12:00:00Z'),
    })

    expect(summary.lowestBalance).toBe(400)
    expect(summary.narrative.tone).toBe('tight')
    expect(summary.narrative.label).toBe('Tight')
    expect(summary.lowPoint).toMatchObject({
      date: '2026-03-12',
      balance: 400,
      triggeredBy: ['Utilities'],
    })
    expect(summary.safeToSpend).toBe(0)
  })

  it('builds a risk verdict when checking goes negative before the next paycheck', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'))

    const monthDate = new Date(2026, 2, 1)
    const openingBalance = 200
    const lowBalanceThreshold = 500
    const projectedIncomes = [makeIncome({ expected_date: '2026-03-18', amount: 1000 })]
    const billTemplates = [makeBill({ amount: -650, name: 'Mortgage' })]
    const ledger = buildMonthLedger({
      month: monthDate,
      openingBalance,
      lowBalanceThreshold,
      transactions: [makeTxn({ posted_at: '2026-03-08T12:00:00Z', amount: -50, description_short: 'Gas' })],
      billTemplates,
      projectedIncomes,
    })

    const summary = buildDashboardPlannerSummary({
      monthDate,
      openingBalance,
      lowBalanceThreshold,
      ledger,
      billsThisMonth: getBillsForMonth(billTemplates, monthDate),
      projectedIncomes,
      summary: summarizeLedger(ledger, openingBalance),
      lowPoints: findUpcomingLowPoints(ledger, lowBalanceThreshold),
      now: new Date('2026-03-10T12:00:00Z'),
    })

    expect(summary.lowestBalance).toBe(-500)
    expect(summary.lowestBalanceDate).toBe('2026-03-12')
    expect(summary.narrative.tone).toBe('risk')
    expect(summary.narrative.headline).toContain('Checking goes negative on Mar 12.')
    expect(summary.safeToSpend).toBe(0)
    expect(summary.runwayMarkers.map((marker) => marker.label)).toEqual(
      expect.arrayContaining(['Today', 'Next bill', 'Next paycheck', 'Pressure point']),
    )
    expect(summary.semanticSummary).toContain('Checking goes negative on Mar 12.')
  })

  it('falls back to month-end framing when there is no projected paycheck ahead', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'))

    const monthDate = new Date(2026, 2, 1)
    const openingBalance = 1200
    const lowBalanceThreshold = 500
    const billTemplates = [makeBill({ amount: -300, due_day_of_month: 28, name: 'Insurance' })]
    const projectedIncomes: CashFlowProjectedIncome[] = []
    const ledger = buildMonthLedger({
      month: monthDate,
      openingBalance,
      lowBalanceThreshold,
      transactions: [],
      billTemplates,
      projectedIncomes,
    })

    const summary = buildDashboardPlannerSummary({
      monthDate,
      openingBalance,
      lowBalanceThreshold,
      ledger,
      billsThisMonth: getBillsForMonth(billTemplates, monthDate),
      projectedIncomes,
      summary: summarizeLedger(ledger, openingBalance),
      lowPoints: findUpcomingLowPoints(ledger, lowBalanceThreshold),
      now: new Date('2026-03-24T12:00:00Z'),
    })

    expect(summary.nextPaycheck).toBeNull()
    expect(summary.focusWindowLabel).toBe('until month end')
    expect(summary.safeToSpend).toBe(400)
    expect(summary.semanticSummary).toContain(`Planning window runs through ${format(endOfMonth(monthDate), 'MMM d')}.`)
  })
})
