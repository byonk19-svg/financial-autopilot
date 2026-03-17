import { ActivityIcon } from '@/components/dashboard/DashboardIcons'
import { getDashboardToneUi } from '@/components/dashboard/dashboardStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardDataFreshnessRow } from '@/hooks/useDashboard'
import { formatShortDateTime } from '@/lib/formatting'

type DashboardDataFreshnessCardProps = {
  lastAccountSyncAt: string | null
  rows: DashboardDataFreshnessRow[]
}

export function DashboardDataFreshnessCard({
  lastAccountSyncAt,
  rows,
}: DashboardDataFreshnessCardProps) {
  const staleCount = rows.filter((row) => row.isStale).length

  return (
    <Card
      aria-labelledby="data-freshness-heading"
      className="border-border/75 bg-card/95 shadow-[0_8px_18px_-20px_hsl(var(--foreground)/0.24)]"
    >
      <CardHeader className="pb-3">
        <CardTitle
          id="data-freshness-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-muted-foreground"
        >
          <ActivityIcon className="h-4 w-4 text-primary/75" />
          Data Freshness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/12 px-3 py-3 text-xs text-muted-foreground">
          <div className="grid gap-1">
            <span>Last sync</span>
            <span className="font-semibold text-foreground">{formatShortDateTime(lastAccountSyncAt)}</span>
          </div>
          <div className="grid gap-1">
            <span>Stale accounts (&gt; 7d since newest transaction)</span>
            <span className="font-semibold text-foreground">{staleCount}</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No connected accounts available.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const tone = getDashboardToneUi(row.isStale ? 'warning' : 'positive')

              return (
                <li
                  key={row.accountId}
                  className={`rounded-lg border px-3 py-3 ${tone.surfaceClassName}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{row.accountName}</p>
                      {row.institution ? (
                        <p className="mt-1 text-xs text-muted-foreground">{row.institution}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.badgeClassName}`}
                    >
                      {row.isStale ? 'Stale' : 'Current'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div className="grid gap-1">
                      <span>Newest transaction</span>
                      <span className="text-foreground">{formatShortDateTime(row.newestTransactionAt)}</span>
                    </div>
                    <div className="grid gap-1">
                      <span>Account sync</span>
                      <span className="text-foreground">
                        {formatShortDateTime(row.lastSyncedAt)}
                        {row.staleDays !== null ? ` • ${row.staleDays}d ago` : ' • no posted transactions yet'}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
