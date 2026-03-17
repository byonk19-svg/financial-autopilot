import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { DashboardMonthlyTrendCard } from './DashboardMonthlyTrendCard'

describe('DashboardMonthlyTrendCard', () => {
  it('renders a semantic monthly summary alongside the visual chart', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/dashboard">
        <DashboardMonthlyTrendCard
          rows={[
            { monthKey: '2026-01', label: 'Jan', income: 3200, expense: 2500, net: 700 },
            { monthKey: '2026-02', label: 'Feb', income: 3100, expense: 3400, net: -300 },
          ]}
        />
      </StaticRouter>,
    )

    expect(markup).toContain('Monthly summary')
    expect(markup).toContain('Jan')
    expect(markup).toContain('Net surplus')
    expect(markup).toContain('Net deficit')
    expect(markup).toContain('Review transaction history')
    expect(markup).toContain('Income versus expense across the last six months.')
  })
})
