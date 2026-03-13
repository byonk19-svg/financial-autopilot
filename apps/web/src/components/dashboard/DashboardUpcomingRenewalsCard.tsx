import { format, parseISO } from 'date-fns'
import { CalendarIcon } from '@/components/dashboard/DashboardIcons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { toNumber } from '@/lib/subscriptionFormatters'
import type { DashboardRenewalRow } from '@/hooks/useDashboard'

function safeDateLabel(value: string | null | undefined, pattern: string): string {
  if (!value) return 'N/A'
  try {
    return format(parseISO(value), pattern)
  } catch {
    return value ?? 'N/A'
  }
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type DashboardUpcomingRenewalsCardProps = {
  upcomingRenewals: DashboardRenewalRow[]
}

export function DashboardUpcomingRenewalsCard({ upcomingRenewals }: DashboardUpcomingRenewalsCardProps) {
  return (
    <Card className="border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Upcoming Renewals</CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingRenewals.length === 0 ? (
          <EmptyState
            className="min-h-[132px]"
            icon={<CalendarIcon className="h-5 w-5" />}
            title="No upcoming renewals"
            description="Subscription renewals due in the next 14 days will show here."
          />
        ) : (
          <ul className="space-y-2">
            {upcomingRenewals.map((renewal) => (
              <li
                key={renewal.subscription_id}
                className="rounded-xl border border-border/75 bg-background/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{renewal.merchant_normalized}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(toNumber(renewal.last_amount))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Next renewal: {safeDateLabel(renewal.next_expected_at, 'MMM d, yyyy')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
