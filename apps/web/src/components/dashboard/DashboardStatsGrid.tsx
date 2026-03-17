import { Link } from 'react-router-dom'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  DollarIcon,
  WalletIcon,
} from '@/components/dashboard/DashboardIcons'
import { getDashboardToneUi } from '@/components/dashboard/dashboardStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  DashboardAnomalyRow,
  DashboardKpis,
  DashboardRenewalRow,
} from '@/hooks/useDashboard'
import { toCurrency, toNumber } from '@/lib/subscriptionFormatters'

type DashboardStatsGridProps = {
  kpis: DashboardKpis
  upcomingRenewals: DashboardRenewalRow[]
  anomalies: DashboardAnomalyRow[]
  renewalMonthlyTotal: number
}

function toPercent(value: number | null): string {
  if (value === null) return 'n/a'
  const pct = value * 100
  const formatted = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1)
  return `${formatted}%`
}

export function DashboardStatsGrid({
  kpis,
  upcomingRenewals,
  anomalies,
  renewalMonthlyTotal,
}: DashboardStatsGridProps) {
  const spendDeltaTone = getDashboardToneUi(kpis.spendDelta > 0 ? 'danger' : kpis.spendDelta < 0 ? 'positive' : 'neutral')

  return (
    <section aria-label="Planning support cards">
      <Card className="border-border/75 bg-card/95 shadow-[0_8px_18px_-20px_hsl(var(--foreground)/0.28)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Planning support</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cash-flow pace, recurring obligations, and unusual charges in one scan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Cash flow MTD
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {toCurrency(kpis.cashFlowMtd)}
                </p>
              </div>
              <DollarIcon className="h-5 w-5 text-primary/70" />
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Income</dt>
                <dd className="mt-1 font-medium text-foreground">{toCurrency(kpis.incomeMtd)}</dd>
                {(kpis.incomeBrianna > 0 || kpis.incomeElaine > 0) && (
                  <dd className="mt-1 text-xs text-muted-foreground">
                    Brianna {toCurrency(kpis.incomeBrianna)} • Elaine {toCurrency(kpis.incomeElaine)}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Spend</dt>
                <dd className="mt-1 font-medium text-foreground">{toCurrency(kpis.spendMtd)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/30 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Spend vs last month
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {toCurrency(kpis.spendMtd)}
                </p>
              </div>
              <WalletIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className={`mt-4 text-sm font-medium ${spendDeltaTone.textClassName}`}>
              {kpis.spendDelta > 0 ? 'Up' : kpis.spendDelta < 0 ? 'Down' : 'Flat'} {toCurrency(Math.abs(kpis.spendDelta))} ({toPercent(kpis.spendDeltaPct)})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last month comparable spend {toCurrency(kpis.spendLastMonth)}
            </p>
          </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-border/60 bg-muted/15 p-3.5" aria-labelledby="dashboard-renewals-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="dashboard-renewals-heading" className="text-sm font-semibold text-foreground">
                  Upcoming bills and renewals
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {upcomingRenewals.length} due in the next 14 days • {toCurrency(renewalMonthlyTotal)} monthly equivalent
                </p>
              </div>
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            </div>

            {upcomingRenewals.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No renewals are due in the next two weeks.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingRenewals.slice(0, 3).map((row) => (
                  <li key={row.subscription_id} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{row.merchant_normalized}</span>
                      <span className="text-muted-foreground">
                        {row.days_until === null ? 'n/a' : `${row.days_until}d`} • {toCurrency(toNumber(row.last_amount))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/subscriptions#subscription-section-bills-loans"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
            >
              Review recurring bills
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </section>

          <section className="rounded-xl border border-border/60 bg-background/30 p-3.5" aria-labelledby="dashboard-anomalies-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="dashboard-anomalies-heading" className="text-sm font-semibold text-foreground">
                  Unusual charges
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exceptions that deserve a quick transaction review.
                </p>
              </div>
              <AlertTriangleIcon className="h-5 w-5 text-muted-foreground" />
            </div>

            {anomalies.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No strong anomalies detected recently.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {anomalies.slice(0, 4).map((row) => {
                  const merchant = row.merchant_canonical || 'Flagged merchant'
                  const merchantQuery = encodeURIComponent(merchant)
                  return (
                    <li key={row.transaction_id}>
                      <Link
                        to={`/transactions?search=${merchantQuery}`}
                        className="block rounded-lg border border-border/60 bg-muted/15 px-3 py-2 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-foreground">{merchant}</span>
                          <span className="text-foreground">{toCurrency(toNumber(row.amount))}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.reason ?? 'Flagged by anomaly detector.'}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            <Link
              to="/transactions"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
            >
              Review transaction history
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </section>
          </section>
        </CardContent>
      </Card>
    </section>
  )
}
