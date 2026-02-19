import StillNeedBadge from './StillNeedBadge'
import type { EmployerRecord, ShiftWeekSummary } from '@/lib/types'

type WeekSummaryBarProps = {
  summary: ShiftWeekSummary
  weeklyGoal: number
  employersById: Record<string, EmployerRecord>
}

export default function WeekSummaryBar({ summary, weeklyGoal, employersById }: WeekSummaryBarProps) {
  const percent = Math.min(summary.totalPay / Math.max(weeklyGoal, 1), 1)

  return (
    <div className="mt-2 space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${summary.goalMet ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.max(6, percent * 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
        <span className="font-semibold text-foreground">${summary.totalPay.toFixed(2)}</span>
        <span>{summary.totalHours.toFixed(2)} hrs</span>
        <span>~${summary.avgRate.toFixed(2)}/hr</span>
        <StillNeedBadge stillNeed={summary.stillNeed} />
      </div>

      {Object.keys(summary.ptoAccrued).length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {Object.entries(summary.ptoAccrued).map(([employerId, hours]) => (
            <span key={employerId} className="rounded-full bg-muted px-2 py-0.5">
              PTO {employersById[employerId]?.short_code ?? employerId}: {hours.toFixed(2)}h
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

