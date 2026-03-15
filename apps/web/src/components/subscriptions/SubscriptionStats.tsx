import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'primary' | 'warning' | 'success' | 'chart'
}) {
  const toneClasses =
    tone === 'primary'
      ? 'border-[hsl(var(--primary)/0.34)] bg-[hsl(var(--primary)/0.08)]'
      : tone === 'warning'
        ? 'border-[hsl(var(--warning)/0.36)] bg-[hsl(var(--warning)/0.1)]'
        : tone === 'success'
          ? 'border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.08)]'
          : 'border-[hsl(var(--chart-3)/0.32)] bg-[hsl(var(--chart-3)/0.08)]'

  return (
    <Card className={`shadow-sm motion-fade-up ${toneClasses}`}>
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
    <Card className="overflow-hidden border-border/80 shadow-sm motion-fade-up motion-stagger-1">
      <div
        className="h-1.5 w-full bg-gradient-to-r from-[hsl(var(--primary)/0.8)] via-[hsl(var(--chart-2)/0.82)] to-[hsl(var(--warning)/0.78)]"
        aria-hidden="true"
      />
      <CardHeader className="space-y-2 p-4">
        <CardTitle id="subscriptions-heading" className="text-2xl md:text-3xl">
          Recurring
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
            tone="primary"
          />
          <StatTile
            label="Bills/Loans Total"
            value={billsAndLoansTotal}
            hint="Fixed obligations"
            tone="warning"
          />
          <StatTile
            label="Next 7 Days Due"
            value={`${nextSevenDaysCount}`}
            hint={nextSevenDaysAmount}
            tone="success"
          />
          <StatTile
            label="Flagged Increases"
            value={`${flaggedIncreases}`}
            hint={`${reviewCount} candidates to review`}
            tone="chart"
          />
        </CardContent>
      )}
    </Card>
  )
}
