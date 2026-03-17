import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getDashboardToneUi } from '@/components/dashboard/dashboardStatus'
import type { DashboardMonthlyTrendRow } from '@/hooks/useDashboard'
import { toCurrency } from '@/lib/subscriptionFormatters'

type DashboardMonthlyTrendCardProps = {
  rows: DashboardMonthlyTrendRow[]
}

export function DashboardMonthlyTrendCard({ rows }: DashboardMonthlyTrendCardProps) {
  const maxValue = rows.reduce((max, row) => Math.max(max, row.income, row.expense), 0)
  const latestRow = rows[rows.length - 1] ?? null
  const totalIncome = rows.reduce((sum, row) => sum + row.income, 0)
  const totalExpense = rows.reduce((sum, row) => sum + row.expense, 0)

  return (
    <Card className="border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-4 sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Monthly Flow Trend</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Income versus expense across the last six months.
            </p>
          </div>
          <div className="rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            6 months
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 || maxValue === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            No income or expense history is available yet.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <TrendSummary label="Income" value={toCurrency(totalIncome)} tone="positive" />
              <TrendSummary label="Expense" value={toCurrency(totalExpense)} tone="negative" />
              <TrendSummary
                label={latestRow ? `${latestRow.label} net` : 'Net'}
                value={toCurrency(latestRow?.net ?? 0)}
                tone={(latestRow?.net ?? 0) >= 0 ? 'positive' : 'negative'}
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Income
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  Expense
                </span>
              </div>

              <div className="grid grid-cols-6 gap-3" aria-hidden="true">
                {rows.map((row) => {
                  const incomeHeight = maxValue > 0 ? (row.income / maxValue) * 100 : 0
                  const expenseHeight = maxValue > 0 ? (row.expense / maxValue) * 100 : 0
                  const netTone = getDashboardToneUi(row.net >= 0 ? 'positive' : 'danger')

                  return (
                    <div key={row.monthKey} className="flex min-w-0 flex-col items-center">
                      <div className="flex h-40 items-end gap-1.5">
                        <div
                          className="w-4 rounded-t-full bg-emerald-500/90 sm:w-5"
                          style={{ height: `${Math.max(incomeHeight, row.income > 0 ? 10 : 0)}%` }}
                          aria-label={`${row.label} income ${toCurrency(row.income)}`}
                          title={`${row.label} income ${toCurrency(row.income)}`}
                        />
                        <div
                          className="w-4 rounded-t-full bg-rose-400/90 sm:w-5"
                          style={{ height: `${Math.max(expenseHeight, row.expense > 0 ? 10 : 0)}%` }}
                          aria-label={`${row.label} expense ${toCurrency(row.expense)}`}
                          title={`${row.label} expense ${toCurrency(row.expense)}`}
                        />
                      </div>
                      <p className="mt-3 text-xs font-semibold text-foreground">{row.label}</p>
                      <p className={`mt-1 text-[11px] ${netTone.textClassName}`}>
                        {row.net >= 0 ? 'Net surplus' : 'Net deficit'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Monthly summary</h3>
                <p className="text-xs text-muted-foreground">Semantic text equivalent of the chart</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="pr-4 font-medium">Month</th>
                      <th className="pr-4 font-medium">Income</th>
                      <th className="pr-4 font-medium">Expense</th>
                      <th className="font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const netTone = getDashboardToneUi(row.net >= 0 ? 'positive' : 'danger')

                      return (
                        <tr key={`summary-${row.monthKey}`} className="align-top">
                          <th className="pr-4 py-1 text-left font-semibold text-foreground">{row.label}</th>
                          <td className="pr-4 py-1 text-muted-foreground">{toCurrency(row.income)}</td>
                          <td className="pr-4 py-1 text-muted-foreground">{toCurrency(row.expense)}</td>
                          <td className={`py-1 ${netTone.textClassName}`}>
                            <span className="font-medium">{row.net >= 0 ? 'Net surplus' : 'Net deficit'}</span>{' '}
                            <span className="tabular-nums">{toCurrency(Math.abs(row.net))}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Link
          to="/transactions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          Review transaction history
        </Link>
      </CardContent>
    </Card>
  )
}

function TrendSummary({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'positive' | 'negative'
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === 'positive' ? 'text-emerald-700' : 'text-rose-700'}`}>
        {value}
      </p>
    </div>
  )
}
