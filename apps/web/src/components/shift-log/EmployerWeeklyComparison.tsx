import { format, parseISO } from 'date-fns'
import { calcWeekSummary } from '@/lib/shiftWeeks'
import type { EmployerRecord, ShiftWeek } from '@/lib/types'

type EmployerWeeklyComparisonProps = {
  weeks: ShiftWeek[]
  employersById: Record<string, EmployerRecord>
  weeklyGoal: number
}

type EmployerComparisonRow = {
  employerId: string
  shortCode: string
  name: string
  color: string
  thisWeekPay: number
  thisWeekHours: number
  lastWeekPay: number
  lastWeekHours: number
  deltaPay: number
}

export default function EmployerWeeklyComparison({
  weeks,
  employersById,
  weeklyGoal,
}: EmployerWeeklyComparisonProps) {
  const currentWeek = weeks[0]
  const priorWeek = weeks[1]

  if (!currentWeek) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Employer weekly comparison</h2>
        <p className="mt-2 text-sm text-muted-foreground">Add shifts to compare employers week-over-week.</p>
      </div>
    )
  }

  const currentSummary = calcWeekSummary(currentWeek, employersById, weeklyGoal)
  const priorSummary = priorWeek ? calcWeekSummary(priorWeek, employersById, weeklyGoal) : null

  const employerIds = new Set<string>([
    ...Object.keys(currentSummary.byEmployer),
    ...(priorSummary ? Object.keys(priorSummary.byEmployer) : []),
  ])

  const rows: EmployerComparisonRow[] = Array.from(employerIds)
    .map((employerId) => {
      const current = currentSummary.byEmployer[employerId] ?? { hours: 0, pay: 0 }
      const prior = priorSummary?.byEmployer[employerId] ?? { hours: 0, pay: 0 }
      const employer = employersById[employerId]

      return {
        employerId,
        shortCode: employer?.short_code ?? 'UNK',
        name: employer?.name ?? 'Unknown employer',
        color: employer?.color ?? '#2563EB',
        thisWeekPay: current.pay,
        thisWeekHours: current.hours,
        lastWeekPay: prior.pay,
        lastWeekHours: prior.hours,
        deltaPay: current.pay - prior.pay,
      }
    })
    .sort((a, b) => b.thisWeekPay - a.thisWeekPay)

  const thisWeekLabel = format(parseISO(`${currentWeek.weekStart}T00:00:00`), 'MMM d')
  const priorWeekLabel = priorWeek ? format(parseISO(`${priorWeek.weekStart}T00:00:00`), 'MMM d') : 'Previous'

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Employer weekly comparison</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {thisWeekLabel} vs {priorWeekLabel}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No paid shifts in the current week yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employer</th>
                <th className="px-3 py-2 text-right font-medium">This week</th>
                <th className="px-3 py-2 text-right font-medium">Last week</th>
                <th className="px-3 py-2 text-right font-medium">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employerId} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: row.color }}
                      >
                        {row.shortCode}
                      </span>
                      <span className="text-foreground">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    ${row.thisWeekPay.toFixed(2)}
                    <div className="text-xs text-muted-foreground">{row.thisWeekHours.toFixed(2)}h</div>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    ${row.lastWeekPay.toFixed(2)}
                    <div className="text-xs text-muted-foreground">{row.lastWeekHours.toFixed(2)}h</div>
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      row.deltaPay >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {row.deltaPay >= 0 ? '+' : '-'}${Math.abs(row.deltaPay).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

