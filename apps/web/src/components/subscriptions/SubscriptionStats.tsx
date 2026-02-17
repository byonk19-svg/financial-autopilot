import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-foreground md:text-xl">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

type SubscriptionStatsProps = {
  monthlySubscriptionsTotal: string
  billsAndLoansTotal: string
  nextSevenDaysCount: number
  nextSevenDaysAmount: string
  flaggedIncreases: number
  reviewCount: number
  loading: boolean
}

export function SubscriptionStats({
  monthlySubscriptionsTotal,
  billsAndLoansTotal,
  nextSevenDaysCount,
  nextSevenDaysAmount,
  flaggedIncreases,
  reviewCount,
  loading,
}: SubscriptionStatsProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-2 p-4">
        <CardTitle id="subscriptions-heading" className="text-2xl md:text-3xl">
          Recurring Charge Dashboard
        </CardTitle>
        <CardDescription className="text-sm md:text-base">
          Review subscriptions, bills or loans, and low-confidence candidates in one place.
        </CardDescription>
      </CardHeader>
      {!loading && (
        <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0 lg:grid-cols-4">
          <StatTile
            label="Monthly Subs Total"
            value={monthlySubscriptionsTotal}
            hint="Active services"
          />
          <StatTile
            label="Bills/Loans Total"
            value={billsAndLoansTotal}
            hint="Fixed obligations"
          />
          <StatTile
            label="Next 7 Days Due"
            value={`${nextSevenDaysCount}`}
            hint={nextSevenDaysAmount}
          />
          <StatTile
            label="Flagged Increases"
            value={`${flaggedIncreases}`}
            hint={`${reviewCount} candidates to review`}
          />
        </CardContent>
      )}
    </Card>
  )
}
