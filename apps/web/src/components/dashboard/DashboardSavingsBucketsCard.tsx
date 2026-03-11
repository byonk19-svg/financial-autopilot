import { WalletIcon } from '@/components/dashboard/DashboardIcons'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toNumber } from '@/lib/subscriptionFormatters'
import type { SavingsBucketSummaryRow, SavingsBucketSummaryRpc } from '@/lib/types'

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ownerBadgeVariant(owner: SavingsBucketSummaryRow['owner']): 'default' | 'secondary' | 'outline' {
  if (owner === 'brianna') return 'default'
  if (owner === 'elaine') return 'secondary'
  return 'outline'
}

type DashboardSavingsBucketsCardProps = {
  savingsSummary: SavingsBucketSummaryRpc | null
  savingsLoading: boolean
}

export function DashboardSavingsBucketsCard({ savingsSummary, savingsLoading }: DashboardSavingsBucketsCardProps) {
  const savingsBuckets = savingsSummary?.buckets ?? []

  return (
    <Card className="motion-fade-up motion-stagger-3">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Savings Buckets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {savingsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/75 bg-muted/40 p-3.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total saved</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(toNumber(savingsSummary?.total_saved ?? null))}
              </p>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                <p>Brianna: {formatCurrency(toNumber(savingsSummary?.total_by_owner?.brianna ?? null))}</p>
                <p>Elaine: {formatCurrency(toNumber(savingsSummary?.total_by_owner?.elaine ?? null))}</p>
                <p>Household: {formatCurrency(toNumber(savingsSummary?.total_by_owner?.household ?? null))}</p>
              </div>
            </div>

            {savingsBuckets.length === 0 ? (
              <EmptyState
                className="min-h-[132px]"
                icon={<WalletIcon className="h-5 w-5" />}
                title="No active savings buckets"
                description="Create a bucket to start tracking savings goals and progress."
              />
            ) : (
              <div className="space-y-3">
                {savingsBuckets.map((bucket) => {
                  const progressValue = Math.max(0, Math.min(100, toNumber(bucket.progress_pct) * 100))
                  return (
                    <div
                      key={bucket.bucket_id}
                      className="space-y-2 rounded-xl border border-border/85 bg-background/35 p-3 transition-colors duration-150 hover:bg-background/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{bucket.name}</p>
                        <Badge variant={ownerBadgeVariant(bucket.owner)}>{bucket.owner}</Badge>
                      </div>
                      <Progress value={progressValue} />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <p>
                          {formatCurrency(toNumber(bucket.current_balance))}
                          {bucket.target_amount == null
                            ? ' / Open-ended'
                            : ` / ${formatCurrency(toNumber(bucket.target_amount))}`}
                        </p>
                        {bucket.weeks_to_goal != null && <p>{bucket.weeks_to_goal} weeks to goal</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
