import { ArrowRight, CalendarClock, Landmark, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardPlannerCheckpoint, DashboardPlannerSummary } from '@/lib/dashboardPlanner'
import { cn } from '@/lib/utils'

type DashboardPlannerHeroProps = {
  summary: DashboardPlannerSummary
  cashFlowMtd: number
  renewalMonthlyTotal: number
  attentionItemCount: number
  plannerLoading: boolean
  plannerError: string
}

export function DashboardPlannerHero({
  summary,
  cashFlowMtd,
  renewalMonthlyTotal,
  attentionItemCount,
  plannerLoading,
  plannerError,
}: DashboardPlannerHeroProps) {
  if (plannerLoading) {
    return (
      <Card className="overflow-hidden border border-border/70 bg-card/95 shadow-[0_14px_28px_-26px_hsl(var(--foreground)/0.35)]">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 w-64 animate-pulse rounded bg-muted/80" />
            <div className="h-3 w-full max-w-2xl animate-pulse rounded bg-muted/70" />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/80" />
                <div className="mt-2 h-5 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/95 shadow-[0_14px_28px_-26px_hsl(var(--foreground)/0.35)]">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] xl:items-start">
          <section className="space-y-4" aria-labelledby="dashboard-planner-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]', toneBadgeClass(summary.narrative.tone))}>
                  {summary.narrative.label} runway
                </Badge>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Checking runway
                  </p>
                  <h2 id="dashboard-planner-heading" className="mt-1.5 text-[clamp(1.7rem,4.2vw,2.7rem)] font-semibold tracking-tight text-foreground">
                    Lowest projected balance
                  </h2>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link to="/cash-flow">
                  Open Cash Flow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
                <p className="text-[clamp(2rem,5.6vw,3.5rem)] font-semibold tracking-tight text-foreground">
                  {summary.lowestBalanceLabel}
                </p>
                <p className="pb-1.5 text-sm text-muted-foreground">{summary.focusWindowLabel}</p>
              </div>
              <p className="max-w-3xl text-[15px] text-foreground/90">{summary.narrative.headline}</p>
              <p className="max-w-3xl text-sm leading-5 text-muted-foreground">{summary.narrative.guidance}</p>
            </div>

            <div className="rounded-[1.4rem] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)/0.96),hsl(var(--muted)/0.18))] p-3.5 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Runway to {summary.nextPaycheck ? 'next paycheck' : 'month end'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current balance {summary.currentBalanceLabel} with the next pressure point on{' '}
                    {summary.lowPoint ? summary.runwayMarkers.find((marker) => marker.id === 'pressure-point')?.shortDate ?? 'this month' : 'none flagged'}.
                  </p>
                </div>
                <div className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Window ends {formatShortDate(summary.focusWindowEndDate)}
                </div>
              </div>

              <div className="relative h-14">
                <div className="absolute left-0 right-0 top-7 h-[3px] rounded-full bg-border/60" aria-hidden="true" />
                {summary.runwayMarkers.map((marker) => (
                  <RunwayMarker key={marker.id} marker={marker} />
                ))}
              </div>
            </div>

            <p className="sr-only">{summary.semanticSummary}</p>

            {plannerError ? (
              <div className="rounded-2xl border border-[hsl(var(--destructive)/0.2)] bg-[hsl(var(--destructive)/0.06)] px-4 py-3 text-sm text-[hsl(var(--destructive)/0.88)]">
                Planner data is partially unavailable. {plannerError}
              </div>
            ) : null}
          </section>

          <section className="grid gap-2.5" aria-label="Planner summary metrics">
            <HeroMetricCard
              icon={CalendarClock}
              label="Next paycheck"
              value={summary.nextPaycheck?.label ?? 'No paycheck scheduled'}
              detail={summary.nextPaycheck?.description ?? 'Add a projected income in Cash Flow if one is missing.'}
            />
            <HeroMetricCard
              icon={Landmark}
              label="Bills due in 14 days"
              value={summary.billsDueSoonLabel}
              detail={
                summary.nextBill
                  ? `Next bill: ${summary.nextBill.description} on ${formatShortDate(summary.nextBill.date)}.`
                  : 'No upcoming bill is due in the next two weeks.'
              }
            />
            <HeroMetricCard
              icon={Wallet}
              label="Safe to spend"
              value={summary.safeToSpendLabel}
              detail={`Extra spend available ${summary.focusWindowLabel}.`}
            />
          </section>
        </div>

        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4" aria-label="Planner supporting metrics">
          <SecondaryMetricCard label="Current checking" value={summary.currentBalanceLabel} />
          <SecondaryMetricCard label="Month cash flow" value={toCurrency(cashFlowMtd)} />
          <SecondaryMetricCard label="Upcoming renewals" value={toCurrency(renewalMonthlyTotal)} />
          <SecondaryMetricCard label="Needs attention" value={`${attentionItemCount}`} />
        </section>
      </CardContent>
    </Card>
  )
}

function RunwayMarker({ marker }: { marker: DashboardPlannerCheckpoint }) {
  return (
    <div
      className="absolute top-0 -translate-x-1/2"
      style={{ left: `${marker.offsetPct}%` }}
    >
      <div className="flex flex-col items-center text-center">
        <span className={cn('h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm', markerDotClass(marker.tone))} aria-hidden="true" />
        <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {marker.label}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-foreground">{marker.shortDate}</span>
      </div>
    </div>
  )
}

function HeroMetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof CalendarClock
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5 shadow-[0_8px_18px_-22px_hsl(var(--foreground)/0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/90 p-1.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

function SecondaryMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-3.5 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function markerDotClass(tone: DashboardPlannerCheckpoint['tone']): string {
  if (tone === 'income') return 'bg-emerald-500'
  if (tone === 'bill') return 'bg-amber-500'
  if (tone === 'risk') return 'bg-rose-500'
  return 'bg-primary'
}

function toneBadgeClass(tone: DashboardPlannerSummary['narrative']['tone']): string {
  if (tone === 'risk') return 'border-rose-300 bg-rose-50 text-rose-900'
  if (tone === 'tight') return 'border-amber-300 bg-amber-50 text-amber-950'
  return 'border-emerald-300 bg-emerald-50 text-emerald-900'
}

function formatShortDate(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function toCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
