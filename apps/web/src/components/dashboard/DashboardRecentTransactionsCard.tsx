import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { getDashboardToneUi } from '@/components/dashboard/dashboardStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardRecentTransaction } from '@/hooks/useDashboard'
import { toCurrency } from '@/lib/subscriptionFormatters'

type DashboardRecentTransactionsCardProps = {
  recentTransactions: DashboardRecentTransaction[]
}

export function DashboardRecentTransactionsCard({
  recentTransactions,
}: DashboardRecentTransactionsCardProps) {
  return (
    <Card className="border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-4 sm:pb-5">
        <CardTitle className="text-base font-semibold">What Changed</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Recent posted income and expense activity that changed the month&apos;s picture.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            No recent posted activity is available yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {recentTransactions.map((transaction) => {
              const tone = getDashboardToneUi(
                transaction.type === 'income'
                  ? 'positive'
                  : transaction.isCredit
                    ? 'warning'
                    : 'neutral',
              )

              return (
                <li
                  key={transaction.id}
                  className={`rounded-2xl border px-4 py-3 ${tone.surfaceClassName}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {transaction.label}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.badgeClassName}`}
                        >
                          {transaction.type === 'income'
                            ? 'Income'
                            : transaction.isCredit
                              ? 'Credit spend'
                              : 'Checking spend'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {safeDateLabel(transaction.postedAt)}
                        {transaction.category ? ` • ${transaction.category}` : ''}
                      </p>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold ${tone.textClassName}`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {toCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <Link
          to="/transactions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          Open the full timeline
        </Link>
      </CardContent>
    </Card>
  )
}

function safeDateLabel(value: string): string {
  try {
    return format(parseISO(value), 'MMM d')
  } catch {
    return value
  }
}
