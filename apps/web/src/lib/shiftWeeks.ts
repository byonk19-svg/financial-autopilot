import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import type { EmployerRecord, ShiftRecord, ShiftWeek, ShiftWeekSummary } from './types'
import { toNumber } from './subscriptionFormatters'

export function getWeekKey(dateStr: string, weekStartsOn: 0 | 1 = 0): string {
  const date = parseISO(`${dateStr}T00:00:00`)
  const weekStart = startOfWeek(date, { weekStartsOn })
  return format(weekStart, "yyyy-'W'ww")
}

export function groupShiftsByWeek(shifts: ShiftRecord[], weekStartsOn: 0 | 1 = 0): ShiftWeek[] {
  const weeks: Record<string, ShiftWeek> = {}

  for (const shift of shifts) {
    const key = getWeekKey(shift.shift_date, weekStartsOn)
    if (!weeks[key]) {
      const date = parseISO(`${shift.shift_date}T00:00:00`)
      const weekStart = startOfWeek(date, { weekStartsOn })
      const weekEnd = endOfWeek(date, { weekStartsOn })
      weeks[key] = {
        key,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        shifts: [],
      }
    }
    weeks[key].shifts.push(shift)
  }

  return Object.values(weeks).sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

export function calcWeekSummary(
  week: ShiftWeek,
  employersById: Record<string, EmployerRecord>,
  weeklyIncomeGoal = 2040,
): ShiftWeekSummary {
  const payShifts = week.shifts.filter((shift) => !shift.is_non_pay)

  const totalHours = payShifts.reduce((sum, shift) => sum + toNumber(shift.hours_worked), 0)
  const totalPay = payShifts.reduce((sum, shift) => sum + toNumber(shift.gross_pay), 0)
  const avgRate = totalHours > 0 ? totalPay / totalHours : 0
  const stillNeed = weeklyIncomeGoal - totalPay

  const byEmployer: Record<string, { hours: number; pay: number }> = {}

  for (const shift of payShifts) {
    if (!byEmployer[shift.employer_id]) {
      byEmployer[shift.employer_id] = { hours: 0, pay: 0 }
    }
    byEmployer[shift.employer_id].hours += toNumber(shift.hours_worked)
    byEmployer[shift.employer_id].pay += toNumber(shift.gross_pay)
  }

  const ptoAccrued: Record<string, number> = {}

  for (const [employerId, stats] of Object.entries(byEmployer)) {
    const employer = employersById[employerId]
    const ptoPolicy = employer?.pto_policy_hours_per_hour
    if (typeof ptoPolicy === 'number' && ptoPolicy > 0) {
      ptoAccrued[employerId] = stats.hours * ptoPolicy
    }
  }

  const round2 = (value: number): number => Math.round(value * 100) / 100

  return {
    totalHours: round2(totalHours),
    totalPay: round2(totalPay),
    avgRate: round2(avgRate),
    stillNeed: round2(stillNeed),
    goalMet: totalPay >= weeklyIncomeGoal,
    byEmployer,
    ptoAccrued,
  }
}

