import { describe, expect, it } from 'vitest'
import {
  buildDashboardMonthlyTrendRows,
  buildDashboardRecentTransactions,
  buildDashboardCreditSpendSummary,
} from './dashboardFinance'

describe('dashboard finance helpers', () => {
  it('buildDashboardMonthlyTrendRows groups income and expense into the requested month buckets', () => {
    const result = buildDashboardMonthlyTrendRows(
      [
        { posted_at: '2026-01-05T12:00:00Z', type: 'income', amount: 1000 },
        { posted_at: '2026-01-08T12:00:00Z', type: 'expense', amount: -250 },
        { posted_at: '2026-03-02T12:00:00Z', type: 'expense', amount: -100 },
        { posted_at: '2026-03-12T12:00:00Z', type: 'income', amount: 600 },
        { posted_at: '2026-02-01T12:00:00Z', type: 'transfer', amount: -999 },
      ],
      3,
      new Date('2026-03-14T12:00:00Z'),
    )

    expect(result).toEqual([
      { monthKey: '2026-01', label: 'Jan', income: 1000, expense: 250, net: 750 },
      { monthKey: '2026-02', label: 'Feb', income: 0, expense: 0, net: 0 },
      { monthKey: '2026-03', label: 'Mar', income: 600, expense: 100, net: 500 },
    ])
  })

  it('buildDashboardRecentTransactions normalizes labels and sorts newest first', () => {
    const result = buildDashboardRecentTransactions([
      {
        id: 'older',
        posted_at: '2026-03-10T12:00:00Z',
        amount: -24.12,
        type: 'expense',
        category: 'Dining',
        description_short: 'fallback row',
        merchant_canonical: null,
        merchant_normalized: 'chipotle',
        is_credit: true,
      },
      {
        id: 'newer',
        posted_at: '2026-03-12T12:00:00Z',
        amount: 1500,
        type: 'income',
        category: null,
        description_short: 'Payroll deposit',
        merchant_canonical: 'Acme Payroll',
        merchant_normalized: null,
        is_credit: false,
      },
    ])

    expect(result).toEqual([
      {
        id: 'newer',
        postedAt: '2026-03-12T12:00:00Z',
        label: 'Acme Payroll',
        amount: 1500,
        type: 'income',
        category: null,
        isCredit: false,
      },
      {
        id: 'older',
        postedAt: '2026-03-10T12:00:00Z',
        label: 'chipotle',
        amount: -24.12,
        type: 'expense',
        category: 'Dining',
        isCredit: true,
      },
    ])
  })

  it('buildDashboardCreditSpendSummary keeps current-month credit spend only', () => {
    const result = buildDashboardCreditSpendSummary(
      [
        {
          id: 'credit-food',
          posted_at: '2026-03-03T12:00:00Z',
          amount: -21.42,
          type: 'expense',
          category: 'Dining',
          description_short: '',
          merchant_canonical: null,
          merchant_normalized: null,
          is_credit: true,
        },
        {
          id: 'credit-food-2',
          posted_at: '2026-03-04T12:00:00Z',
          amount: -18.58,
          type: 'expense',
          category: 'Dining',
          description_short: '',
          merchant_canonical: null,
          merchant_normalized: null,
          is_credit: true,
        },
        {
          id: 'checking-food',
          posted_at: '2026-03-05T12:00:00Z',
          amount: -99,
          type: 'expense',
          category: 'Groceries',
          description_short: '',
          merchant_canonical: null,
          merchant_normalized: null,
          is_credit: false,
        },
        {
          id: 'last-month-credit',
          posted_at: '2026-02-20T12:00:00Z',
          amount: -200,
          type: 'expense',
          category: 'Travel',
          description_short: '',
          merchant_canonical: null,
          merchant_normalized: null,
          is_credit: true,
        },
      ],
      new Date('2026-03-14T12:00:00Z'),
    )

    expect(result).toEqual({
      total: 40,
      topCategories: [{ category: 'Dining', amount: 40 }],
    })
  })
})
