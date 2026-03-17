import { Gauge } from 'lucide-react'
import { getDashboardToneUi } from '@/components/dashboard/dashboardStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { DashboardAutopilotMetrics } from '@/hooks/useDashboard'

type DashboardAutopilotMetricsCardProps = {
  metrics: DashboardAutopilotMetrics
}

function formatRate(rate: number | null): string {
  if (rate === null) return 'n/a'
  return `${Math.max(0, Math.min(100, rate)).toFixed(1)}%`
}

function progressValue(rate: number | null): number {
  if (rate === null) return 0
  return Math.max(0, Math.min(100, rate))
}

export function DashboardAutopilotMetricsCard({ metrics }: DashboardAutopilotMetricsCardProps) {
  const tone = getDashboardToneUi(
    metrics.autoCategorizedRatePct !== null && metrics.autoCategorizedRatePct >= 80
      ? 'positive'
      : metrics.autoCategorizedRatePct !== null && metrics.autoCategorizedRatePct >= 60
        ? 'warning'
        : 'danger',
  )

  return (
    <Card className="border-border/75 bg-card/95 shadow-[0_8px_18px_-20px_hsl(var(--foreground)/0.28)]">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          Autopilot Coverage
        </CardTitle>
        <p className="text-xs text-muted-foreground">How much recent categorization work the system handled for you.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto-categorized on import (30d)</p>
          <p className={`mt-1 text-xl font-semibold ${tone.textClassName}`}>{formatRate(metrics.autoCategorizedRatePct)}</p>
          <p className="text-xs text-muted-foreground">
            {metrics.autoCategorizedCount30d} of {metrics.totalEligibleCount30d} eligible transactions
          </p>
          <div className="mt-2">
            <Progress value={progressValue(metrics.autoCategorizedRatePct)} />
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Uncategorized (7d)</p>
            <p className="mt-1 font-semibold text-foreground">{metrics.uncategorizedCount7d}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Manual fixes (7d)</p>
            <p className="mt-1 font-semibold text-foreground">{metrics.manualFixes7d}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
