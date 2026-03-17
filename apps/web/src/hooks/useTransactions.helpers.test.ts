import { describe, expect, it } from 'vitest'
import { describeTransactionsAdvancedFilters } from './useTransactions.helpers'

describe('describeTransactionsAdvancedFilters', () => {
  it('returns the default summary when no advanced filters are active', () => {
    expect(
      describeTransactionsAdvancedFilters({
        startDate: '',
        endDate: '',
        accountFilter: '',
        categoryFilter: '',
        showPending: false,
        showHidden: false,
      }),
    ).toBe('Dates, account, category, and visibility controls')
  })

  it('summarizes active advanced filters for the collapsed mobile panel', () => {
    expect(
      describeTransactionsAdvancedFilters({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        accountFilter: 'acct-1',
        categoryFilter: '',
        showPending: true,
        showHidden: false,
      }),
    ).toBe('3 active: date range, account, show pending')
  })
})
