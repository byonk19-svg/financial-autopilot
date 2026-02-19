import { format, parseISO } from 'date-fns'
import { calcWeekSummary } from '@/lib/shiftWeeks'
import type { EmployerRecord, ShiftWeek } from '@/lib/types'

type WeeklyGoalTrendProps = {
  weeks: ShiftWeek[]
  employersById: Record<string, EmployerRecord>
  weeklyGoal: number
}

type TrendPoint = {
  key: string
  weekLabel: string
  totalPay: number
  stillNeed: number
  goalMet: boolean
  widthPct: number
}

export default function WeeklyGoalTrend({ weeks, employersById, weeklyGoal }: WeeklyGoalTrendProps) {
  const points = weeks.slice(0, 8).map((week) => {
    const summary = calcWeekSummary(week, employersById, weeklyGoal)
    return {
      key: week.key,
      weekLabel: format(parseISO(`${week.weekStart}T00:00:00`), 'MMM d'),
      totalPay: summary.totalPay,
      stillNeed: summary.stillNeed,
      goalMet: summary.goalMet,
    }
  })

  const maxPay = Math.max(weeklyGoal, ...points.map((point) => point.totalPay), 1)

  const chartPoints: TrendPoint[] = points.map((point) => ({
    ...point,
    widthPct: Math.max(6, (point.totalPay / maxPay) * 100),
  }))

  if (chartPoints.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Weekly goal trend</h2>
        <p className="mt-2 text-sm text-muted-foreground">Add shifts to start tracking weekly progress.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Weekly goal trend</h2>
      <p className="mt-1 text-sm text-muted-foreground">Last {chartPoints.length} weeks vs ${weeklyGoal.toFixed(2)} goal</p>

      <div className="mt-4 space-y-3">
        {chartPoints.map((point) => {
          const gapText = point.goalMet
            ? `+$${Math.abs(point.stillNeed).toFixed(2)} over`
            : `$${Math.abs(point.stillNeed).toFixed(2)} to go`

          return (
            <div key={point.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{point.weekLabel}</span>
                <span className="font-medium text-foreground">${point.totalPay.toFixed(2)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${point.goalMet ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${point.widthPct}%` }}
                />
              </div>
              <p className={`text-xs ${point.goalMet ? 'text-emerald-700' : 'text-amber-700'}`}>{gapText}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

