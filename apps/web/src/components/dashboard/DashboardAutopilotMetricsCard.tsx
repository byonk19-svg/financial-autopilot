import { Gauge } from 'lucide-react'
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
  return (
    <Card className="border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.08)] motion-fade-up motion-stagger-3">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold">
          <Gauge className="h-4 w-4 text-primary" />
          Autopilot Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto-categorized on import (30d)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatRate(metrics.autoCategorizedRatePct)}</p>
          <p className="text-xs text-muted-foreground">
            {metrics.autoCategorizedCount30d} of {metrics.totalEligibleCount30d} eligible transactions
          </p>
          <div className="mt-2">
            <Progress value={progressValue(metrics.autoCategorizedRatePct)} />
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Uncategorized (7d)</p>
            <p className="mt-1 font-semibold text-foreground">{metrics.uncategorizedCount7d}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Manual fixes (7d)</p>
            <p className="mt-1 font-semibold text-foreground">{metrics.manualFixes7d}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
