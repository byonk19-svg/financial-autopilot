import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { DashboardPlannerHero } from './DashboardPlannerHero'
import type { DashboardPlannerSummary } from '@/lib/dashboardPlanner'

const summary: DashboardPlannerSummary = {
  currentBalance: 2140.43,
  currentBalanceLabel: '$2,140.43',
  lowestBalance: 1180,
  lowestBalanceDate: '2026-03-24',
  lowestBalanceLabel: '$1,180.00 on Mar 24',
  monthNetTotal: 620,
  nextPaycheck: {
    date: '2026-03-28',
    amount: 1850,
    description: 'HCA payroll',
    label: 'Mar 28 • $1,850.00',
  },
  nextBill: {
    date: '2026-03-21',
    amount: 420,
    description: 'Mortgage',
    label: 'Mar 21 • $420.00',
  },
  lowPoint: {
    date: '2026-03-24',
    balance: 1180,
    triggeredBy: ['Mortgage', 'Utilities'],
  },
  billsDueSoonCount: 3,
  billsDueSoonTotal: 980,
  billsDueSoonLabel: '3 due • $980.00',
  safeToSpend: 680,
  safeToSpendLabel: '$680.00',
  focusWindowLabel: 'until next paycheck',
  focusWindowEndDate: '2026-03-28',
  narrative: {
    tone: 'safe',
    label: 'Safe',
    headline: 'Checking stays above your $500.00 floor this month.',
    guidance: 'Use the runway below to confirm the next squeeze point, then leave the setup tools alone unless something changed.',
  },
  runwayMarkers: [
    {
      id: 'today',
      label: 'Today',
      date: '2026-03-17',
      shortDate: 'Mar 17',
      offsetPct: 0,
      tone: 'today',
      detail: 'Current projected balance $2,140.43',
    },
    {
      id: 'next-bill',
      label: 'Next bill',
      date: '2026-03-21',
      shortDate: 'Mar 21',
      offsetPct: 40,
      tone: 'bill',
      detail: 'Mortgage • $420.00',
    },
    {
      id: 'pressure-point',
      label: 'Pressure point',
      date: '2026-03-24',
      shortDate: 'Mar 24',
      offsetPct: 70,
      tone: 'risk',
      detail: '$1,180.00 • Mortgage, Utilities',
    },
    {
      id: 'next-paycheck',
      label: 'Next paycheck',
      date: '2026-03-28',
      shortDate: 'Mar 28',
      offsetPct: 100,
      tone: 'income',
      detail: 'HCA payroll • $1,850.00',
    },
  ],
  semanticSummary:
    'Lowest projected balance is $1,180.00 on Mar 24. Next paycheck of $1,850.00 arrives Mar 28. 3 bills due in the next 14 days total $980.00. Safe to spend before the next paycheck is $680.00. Checking stays above your $500.00 floor this month. Planning window runs through Mar 28.',
}

describe('DashboardPlannerHero', () => {
  it('renders the primary planner metric, support metrics, semantic summary, and cash-flow CTA', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/dashboard">
        <DashboardPlannerHero
          summary={summary}
          cashFlowMtd={620}
          renewalMonthlyTotal={146}
          attentionItemCount={4}
          plannerLoading={false}
          plannerError=""
        />
      </StaticRouter>,
    )

    expect(markup).toContain('Lowest projected balance')
    expect(markup).toContain('$1,180.00 on Mar 24')
    expect(markup).toContain('Checking stays above your $500.00 floor this month.')
    expect(markup).toContain('Next paycheck')
    expect(markup).toContain('Bills due in 14 days')
    expect(markup).toContain('Safe to spend')
    expect(markup).toContain('Current checking')
    expect(markup).toContain('Month cash flow')
    expect(markup).toContain('Upcoming renewals')
    expect(markup).toContain('Needs attention')
    expect(markup).toContain(summary.semanticSummary)
    expect(markup).toContain('href="/cash-flow"')
  })
})
