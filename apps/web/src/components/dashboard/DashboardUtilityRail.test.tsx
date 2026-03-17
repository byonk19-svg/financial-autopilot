import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { DashboardDataFreshnessCard } from './DashboardDataFreshnessCard'
import { DashboardStatsGrid } from './DashboardStatsGrid'
import { DashboardSystemHealthCard } from './DashboardSystemHealthCard'

describe('Dashboard utility rail and deep links', () => {
  it('renders metadata labels separately from values and deep-links support cards to focused destinations', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/dashboard">
        <div>
          <DashboardStatsGrid
            kpis={{
              incomeMtd: 3200,
              incomeBrianna: 1600,
              incomeElaine: 1600,
              spendMtd: 2400,
              cashFlowMtd: 800,
              spendLastMonth: 2100,
              spendDelta: 300,
              spendDeltaPct: 0.142857,
              topCategories: [],
            }}
            upcomingRenewals={[
              {
                subscription_id: 'renewal-1',
                merchant_normalized: 'Netflix',
                cadence: 'monthly',
                next_expected_at: '2026-03-21',
                last_amount: 19.99,
                monthly_equivalent: 19.99,
                days_until: 4,
              },
            ]}
            anomalies={[
              {
                transaction_id: 'txn-1',
                posted_at: '2026-03-17T00:00:00Z',
                merchant_canonical: 'Target',
                amount: 180.33,
                baseline_avg: 50,
                baseline_stddev: 10,
                score: 4.2,
                reason: 'Much larger than usual.',
              },
            ]}
            renewalMonthlyTotal={19.99}
          />
          <DashboardDataFreshnessCard
            lastAccountSyncAt="2026-03-17T13:00:00Z"
            rows={[
              {
                accountId: 'acct-1',
                accountName: 'Checking',
                institution: 'Chase',
                lastSyncedAt: '2026-03-17T13:00:00Z',
                newestTransactionAt: '2026-03-16T12:00:00Z',
                isStale: false,
                staleDays: 1,
              },
            ]}
          />
          <DashboardSystemHealthCard
            healthLoading={false}
            healthError=""
            systemHealth={{
              ok: true,
              generated_at: '2026-03-17T13:00:00Z',
              latest_error: null,
              jobs: [
                {
                  job_name: 'nightly_analysis',
                  schedule: '0 3 * * *',
                  last_run_at: '2026-03-17T03:00:00Z',
                  last_status: 'succeeded',
                  last_error: null,
                },
              ],
            }}
            lastAccountSyncAt="2026-03-17T13:00:00Z"
            lastAnalysisAt="2026-03-17T03:00:00Z"
            lastWeeklyInsightsAt="2026-03-16T08:00:00Z"
          />
        </div>
      </StaticRouter>,
    )

    expect(markup).toContain('href="/subscriptions#subscription-section-bills-loans"')
    expect(markup).toContain('href="/transactions?search=Target"')
    expect(markup).toContain('Last account sync')
    expect(markup).toContain('Last analysis run')
    expect(markup).toContain('Newest transaction')
    expect(markup).toContain('Account sync')
  })
})
