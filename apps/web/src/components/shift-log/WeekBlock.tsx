import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import ShiftRow from './ShiftRow'
import WeekSummaryBar from './WeekSummaryBar'
import { calcWeekSummary } from '@/lib/shiftWeeks'
import type { EmployerLocationRecord, EmployerRecord, ShiftRecord, ShiftWeek } from '@/lib/types'

type WeekBlockProps = {
  week: ShiftWeek
  weeklyGoal: number
  employersById: Record<string, EmployerRecord>
  locationsById: Record<string, EmployerLocationRecord>
  onEditShift: (shift: ShiftRecord) => void
  onDuplicateShift: (shift: ShiftRecord) => void
  onDeleteShift: (shiftId: string) => void
  busyShiftId: string | null
  defaultExpanded?: boolean
}

export default function WeekBlock({
  week,
  weeklyGoal,
  employersById,
  locationsById,
  onEditShift,
  onDuplicateShift,
  onDeleteShift,
  busyShiftId,
  defaultExpanded = false,
}: WeekBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const summary = useMemo(
    () => calcWeekSummary(week, employersById, weeklyGoal),
    [employersById, week, weeklyGoal],
  )

  const label = `${format(parseISO(`${week.weekStart}T00:00:00`), 'MMM d')} – ${format(
    parseISO(`${week.weekEnd}T00:00:00`),
    'MMM d',
  )}`

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{week.shifts.length} shifts</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {expanded ? 'Hide shifts' : 'Show shifts'}
          </span>
        </div>
        <WeekSummaryBar summary={summary} weeklyGoal={weeklyGoal} employersById={employersById} />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {week.shifts
            .slice()
            .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
            .map((shift) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                employer={employersById[shift.employer_id]}
                location={shift.location_id ? locationsById[shift.location_id] : undefined}
                onEdit={onEditShift}
                onDuplicate={onDuplicateShift}
                onDelete={onDeleteShift}
                busy={busyShiftId === shift.id}
              />
            ))}
        </div>
      ) : null}
    </article>
  )
}

