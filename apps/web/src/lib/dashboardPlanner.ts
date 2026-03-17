import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  max as maxDate,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import type { CashFlowLedgerDay, CashFlowLedgerEntry, CashFlowProjectedIncome } from './types'

type PlannerTone = 'safe' | 'tight' | 'risk'

type PlannerLowPoint = {
  date: string
  balance: number
  triggeredBy: string[]
}

type PlannerSummaryInput = {
  monthDate: Date
  openingBalance: number
  lowBalanceThreshold: number
  ledger: CashFlowLedgerDay[]
  billsThisMonth: CashFlowLedgerEntry[]
  projectedIncomes: CashFlowProjectedIncome[]
  summary: {
    lowestBalance: number
    lowestBalanceDate: string | null
    netTotal: number
  }
  lowPoints: PlannerLowPoint[]
  now?: Date
}

export type DashboardPlannerNarrative = {
  tone: PlannerTone
  label: string
  headline: string
  guidance: string
}

export type DashboardPlannerCheckpoint = {
  id: string
  label: string
  date: string
  shortDate: string
  offsetPct: number
  tone: 'today' | 'income' | 'bill' | 'risk'
  detail: string
}

export type DashboardPlannerMilestone = {
  date: string
  amount: number
  description: string
  label: string
}

export type DashboardPlannerSummary = {
  currentBalance: number
  currentBalanceLabel: string
  lowestBalance: number
  lowestBalanceDate: string | null
  lowestBalanceLabel: string
  monthNetTotal: number
  nextPaycheck: DashboardPlannerMilestone | null
  nextBill: DashboardPlannerMilestone | null
  lowPoint: PlannerLowPoint | null
  billsDueSoonCount: number
  billsDueSoonTotal: number
  billsDueSoonLabel: string
  safeToSpend: number
  safeToSpendLabel: string
  focusWindowLabel: string
  focusWindowEndDate: string
  narrative: DashboardPlannerNarrative
  runwayMarkers: DashboardPlannerCheckpoint[]
  semanticSummary: string
}

export function buildDashboardPlannerSummary({
  monthDate,
  openingBalance,
  lowBalanceThreshold,
  ledger,
  billsThisMonth,
  projectedIncomes,
  summary,
  lowPoints,
  now = new Date(),
}: PlannerSummaryInput): DashboardPlannerSummary {
  const today = startOfDay(now)
  const todayKey = format(today, 'yyyy-MM-dd')
  const monthEndDate = endOfMonth(monthDate)
  const monthEndKey = format(monthEndDate, 'yyyy-MM-dd')
  const currentDay =
    ledger.find((day) => day.date === todayKey) ??
    [...ledger].reverse().find((day) => day.date < todayKey) ??
    ledger[0] ??
    null

  const currentBalance = round2(currentDay?.runningBalance ?? openingBalance)
  const upcomingIncomes = projectedIncomes
    .filter((income) => income.is_active && income.expected_date >= todayKey)
    .sort((left, right) => left.expected_date.localeCompare(right.expected_date))
  const upcomingBills = billsThisMonth
    .filter((bill) => bill.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date))
  const nextPaycheck = upcomingIncomes[0]
    ? {
        date: upcomingIncomes[0].expected_date,
        amount: round2(Math.abs(Number(upcomingIncomes[0].amount ?? 0))),
        description: upcomingIncomes[0].description,
        label: `${formatShortDate(upcomingIncomes[0].expected_date)} • ${toCurrency(Math.abs(Number(upcomingIncomes[0].amount ?? 0)))}`,
      }
    : null
  const nextBill = upcomingBills[0]
    ? {
        date: upcomingBills[0].date,
        amount: round2(Math.abs(Number(upcomingBills[0].amount ?? 0))),
        description: upcomingBills[0].description,
        label: `${formatShortDate(upcomingBills[0].date)} • ${toCurrency(Math.abs(Number(upcomingBills[0].amount ?? 0)))}`,
      }
    : null

  const upcomingLowPoints = lowPoints
    .filter((point) => point.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date))
  const lowPoint = upcomingLowPoints[0] ?? null
  const narrative = buildPlannerNarrative(
    summary.lowestBalance,
    summary.lowestBalanceDate,
    lowBalanceThreshold,
    lowPoint,
  )

  const billsDueSoon = upcomingBills.filter((bill) => {
    const daysAway = differenceInCalendarDays(parseISO(bill.date), today)
    return daysAway >= 0 && daysAway <= 14
  })
  const billsDueSoonTotal = round2(
    billsDueSoon.reduce((sum, bill) => sum + Math.abs(Number(bill.amount ?? 0)), 0),
  )
  const billsDueSoonCount = billsDueSoon.length

  const focusWindowEndDate = nextPaycheck?.date ?? monthEndKey
  const focusWindowLabel = nextPaycheck ? 'until next paycheck' : 'until month end'
  const windowDays = ledger.filter((day) => day.date >= todayKey && day.date <= focusWindowEndDate)
  const lowestWindowBalance =
    windowDays.reduce<number | null>((lowest, day) => {
      if (lowest === null || day.runningBalance < lowest) return day.runningBalance
      return lowest
    }, null) ?? currentBalance
  const safeToSpend = round2(Math.max(0, lowestWindowBalance - lowBalanceThreshold))

  const runwayMarkers = buildRunwayMarkers({
    todayKey,
    currentBalance,
    nextBill,
    nextPaycheck,
    lowPoint,
    monthDate,
  })

  const semanticSummaryParts = [
    `Lowest projected balance is ${toCurrency(summary.lowestBalance)} on ${summary.lowestBalanceDate ? formatShortDate(summary.lowestBalanceDate) : 'this month'}.`,
    nextPaycheck
      ? `Next paycheck of ${toCurrency(nextPaycheck.amount)} arrives ${formatShortDate(nextPaycheck.date)}.`
      : 'No projected paycheck is scheduled ahead.',
    billsDueSoonCount > 0
      ? `${billsDueSoonCount} bill${billsDueSoonCount === 1 ? '' : 's'} due in the next 14 days total ${toCurrency(billsDueSoonTotal)}.`
      : 'No bills are due in the next 14 days.',
    `Safe to spend before ${nextPaycheck ? 'the next paycheck' : 'month end'} is ${toCurrency(safeToSpend)}.`,
    narrative.headline,
    `Planning window runs through ${formatShortDate(focusWindowEndDate)}.`,
  ]

  return {
    currentBalance,
    currentBalanceLabel: toCurrency(currentBalance),
    lowestBalance: round2(summary.lowestBalance),
    lowestBalanceDate: summary.lowestBalanceDate,
    lowestBalanceLabel: summary.lowestBalanceDate
      ? `${toCurrency(summary.lowestBalance)} on ${formatShortDate(summary.lowestBalanceDate)}`
      : toCurrency(summary.lowestBalance),
    monthNetTotal: round2(summary.netTotal),
    nextPaycheck,
    nextBill,
    lowPoint,
    billsDueSoonCount,
    billsDueSoonTotal,
    billsDueSoonLabel:
      billsDueSoonCount > 0
        ? `${billsDueSoonCount} due • ${toCurrency(billsDueSoonTotal)}`
        : 'No bills due soon',
    safeToSpend,
    safeToSpendLabel: toCurrency(safeToSpend),
    focusWindowLabel,
    focusWindowEndDate,
    narrative,
    runwayMarkers,
    semanticSummary: semanticSummaryParts.join(' '),
  }
}

function buildPlannerNarrative(
  lowestBalance: number,
  lowestBalanceDate: string | null,
  threshold: number,
  lowPoint: PlannerLowPoint | null,
): DashboardPlannerNarrative {
  if (lowestBalance < 0) {
    return {
      tone: 'risk',
      label: 'At risk',
      headline: `Checking goes negative on ${
        lowestBalanceDate ? formatShortDate(lowestBalanceDate) : lowPoint ? formatShortDate(lowPoint.date) : 'this month'
      }.`,
      guidance: 'Move or pause bills, add a paycheck projection, or cut discretionary transfers before that date.',
    }
  }

  if (lowestBalance <= threshold) {
    return {
      tone: 'tight',
      label: 'Tight',
      headline: `You stay positive, but dip under your ${toCurrency(threshold)} comfort floor.`,
      guidance: 'Watch the next squeeze point closely and avoid extra spending before the next income lands.',
    }
  }

  return {
    tone: 'safe',
    label: 'Safe',
    headline: `Checking stays above your ${toCurrency(threshold)} floor this month.`,
    guidance: 'Use the runway below to confirm the next squeeze point, then leave the setup tools alone unless something changed.',
  }
}

function buildRunwayMarkers({
  todayKey,
  currentBalance,
  nextBill,
  nextPaycheck,
  lowPoint,
  monthDate,
}: {
  todayKey: string
  currentBalance: number
  nextBill: DashboardPlannerMilestone | null
  nextPaycheck: DashboardPlannerMilestone | null
  lowPoint: PlannerLowPoint | null
  monthDate: Date
}): DashboardPlannerCheckpoint[] {
  const windowStart = maxDate([parseISO(todayKey), startOfMonth(monthDate)])
  const windowEnd = nextPaycheck ? parseISO(nextPaycheck.date) : endOfMonth(monthDate)
  const totalDays = Math.max(1, differenceInCalendarDays(windowEnd, windowStart))

  const markers: DashboardPlannerCheckpoint[] = [
    {
      id: 'today',
      label: 'Today',
      date: todayKey,
      shortDate: formatShortDate(todayKey),
      offsetPct: 0,
      tone: 'today',
      detail: `Current projected balance ${toCurrency(currentBalance)}`,
    },
  ]

  if (nextBill) {
    markers.push({
      id: 'next-bill',
      label: 'Next bill',
      date: nextBill.date,
      shortDate: formatShortDate(nextBill.date),
      offsetPct: markerOffset(nextBill.date, windowStart, totalDays),
      tone: 'bill',
      detail: `${nextBill.description} • ${toCurrency(nextBill.amount)}`,
    })
  }

  if (nextPaycheck) {
    markers.push({
      id: 'next-paycheck',
      label: 'Next paycheck',
      date: nextPaycheck.date,
      shortDate: formatShortDate(nextPaycheck.date),
      offsetPct: markerOffset(nextPaycheck.date, windowStart, totalDays),
      tone: 'income',
      detail: `${nextPaycheck.description} • ${toCurrency(nextPaycheck.amount)}`,
    })
  }

  if (lowPoint) {
    markers.push({
      id: 'pressure-point',
      label: 'Pressure point',
      date: lowPoint.date,
      shortDate: formatShortDate(lowPoint.date),
      offsetPct: markerOffset(lowPoint.date, windowStart, totalDays),
      tone: 'risk',
      detail: `${toCurrency(lowPoint.balance)}${lowPoint.triggeredBy.length > 0 ? ` • ${lowPoint.triggeredBy.join(', ')}` : ''}`,
    })
  }

  return markers
}

function markerOffset(dateKey: string, windowStart: Date, totalDays: number): number {
  const daysAway = Math.max(0, differenceInCalendarDays(parseISO(dateKey), windowStart))
  return Math.min(100, (daysAway / totalDays) * 100)
}

function formatShortDate(dateKey: string): string {
  return format(parseISO(dateKey), 'MMM d')
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
