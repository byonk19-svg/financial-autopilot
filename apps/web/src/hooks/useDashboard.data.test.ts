import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/errorReporting', () => ({
  captureException: mocks.captureException,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}))

import { fetchDashboardSnapshot } from './useDashboard.data'

type QueryResult = {
  data?: unknown
  error?: unknown
  count?: number | null
}

function makeQuery(result: QueryResult) {
  const promise = Promise.resolve(result)
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  return builder
}

describe('fetchDashboardSnapshot', () => {
  beforeEach(() => {
    mocks.captureException.mockReset()
    mocks.rpc.mockReset()
    mocks.from.mockReset()
  })

  it('returns partial dashboard data and a user-facing warning when one source fails', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          credit_spend_mtd: 42,
          cash_flow_mtd: 10,
          uncategorized_count: 1,
          accounts_total: 2,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('anomalies down') })
      .mockResolvedValueOnce({
        data: {
          auto_categorized_count_30d: 2,
          review_subscriptions: 1,
          total_eligible_count_30d: 5,
          uncategorized_count_7d: 1,
          uncategorized_transactions: 3,
          manual_fixes_7d: 4,
          unread_alerts: 2,
          unowned_accounts: 0,
        },
        error: null,
      })

    const fromResults: QueryResult[] = [
      { data: [{ id: 'acct-1', name: 'Checking', institution: 'Bank', last_synced_at: '2026-03-16T00:00:00.000Z' }], error: null },
      { data: [{ account_id: 'acct-1', posted_at: '2026-03-15T00:00:00.000Z' }], error: null },
      { data: { updated_at: '2026-03-16T12:00:00.000Z' }, error: null },
      { data: { created_at: '2026-03-16T13:00:00.000Z' }, error: null },
      { data: [], error: null },
      {
        data: [
          {
            id: 'txn-1',
            posted_at: '2026-03-12T00:00:00.000Z',
            amount: -42,
            type: 'expense',
            category: 'streaming',
            description_short: 'Claude subscription',
            merchant_canonical: 'CLAUDE AI',
            merchant_normalized: 'CLAUDE AI',
            is_credit: true,
          },
        ],
        error: null,
      },
    ]

    mocks.from.mockImplementation(() => {
      const next = fromResults.shift()
      if (!next) throw new Error('Unexpected query')
      return makeQuery(next)
    })

    const snapshot = await fetchDashboardSnapshot('user-1')

    expect(snapshot.errorMessage).toBe('Some dashboard metrics could not be loaded.')
    expect(snapshot.attentionCounts.uncategorizedTransactions).toBe(3)
    expect(snapshot.attentionCounts.unreadAlerts).toBe(2)
    expect(snapshot.autopilotMetrics.totalEligibleCount30d).toBe(5)
    expect(snapshot.autopilotMetrics.autoCategorizedCount30d).toBe(2)
    expect(snapshot.lastAnalysisAt).toBe('2026-03-16T12:00:00.000Z')
    expect(snapshot.lastWeeklyInsightsAt).toBe('2026-03-16T13:00:00.000Z')
    expect(snapshot.recentTransactions).toHaveLength(1)
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, 'dashboard_summary_counts')
    expect(mocks.captureException).toHaveBeenCalledTimes(1)
  })
})
