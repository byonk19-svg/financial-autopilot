import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
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
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Latest posted income and expense transactions included in the dashboard.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            No recent posted activity is available yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {recentTransactions.map((transaction) => (
              <li
                key={transaction.id}
                className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {transaction.label}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          transaction.type === 'income'
                            ? 'bg-emerald-50 text-emerald-800'
                            : transaction.isCredit
                              ? 'bg-amber-50 text-amber-900'
                              : 'bg-muted text-foreground/80'
                        }`}
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
                  <p
                    className={`shrink-0 text-sm font-semibold ${
                      transaction.type === 'income' ? 'text-emerald-700' : 'text-foreground'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {toCurrency(Math.abs(transaction.amount))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/transactions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          Open transactions
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
