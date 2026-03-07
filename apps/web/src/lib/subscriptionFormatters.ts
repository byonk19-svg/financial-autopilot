import type { SubscriptionCadence } from '@/lib/types'

export type { SubscriptionCadence } from '@/lib/types'
export type DensityMode = 'comfortable' | 'compact'

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

export function toRecurringMerchantLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return 'Unknown Merchant'

  const normalized = trimmed.toUpperCase()
  if (normalized === 'NFX') return 'Netflix'
  if (normalized.startsWith('NFX ')) {
    const suffix = trimmed.slice(4).trim()
    return suffix ? `Netflix - ${toTitleCase(suffix)}` : 'Netflix'
  }

  return trimmed
}

export function toNumber(value: number | string | null): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function toCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toShortDate(value: string | null): string {
  const date = parseDate(value)
  if (!date) return value ?? 'Unknown'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function toCadenceLabel(value: SubscriptionCadence): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function toMonthlyEquivalentAmount(input: {
  lastAmount: number | string | null
  cadence: SubscriptionCadence
}): number {
  const amount = toNumber(input.lastAmount)
  if (amount <= 0) return 0
  if (input.cadence === 'weekly') return amount * (52 / 12)
  if (input.cadence === 'monthly') return amount
  if (input.cadence === 'quarterly') return amount / 3
  if (input.cadence === 'yearly') return amount / 12
  return amount
}

export function defaultNotifyDaysForCadence(cadence: SubscriptionCadence): number {
  return cadence === 'yearly' ? 7 : 3
}

export function effectiveNotifyDays(input: {
  cadence: SubscriptionCadence
  notifyDaysBefore: number | null
}): number {
  const provided = input.notifyDaysBefore
  if (typeof provided === 'number' && Number.isFinite(provided) && provided > 0) return Math.round(provided)
  return defaultNotifyDaysForCadence(input.cadence)
}

export function daysUntilDate(value: string | null): number | null {
  const date = parseDate(value)
  if (!date) return null
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / (24 * 60 * 60 * 1000))
}

export function toRenewalLabel(value: string | null): string {
  const days = daysUntilDate(value)
  if (days === null) return 'Unknown'
  if (days === 0) return 'Renews today'
  if (days > 0) return `Renews in ${days} day${days === 1 ? '' : 's'}`
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
}

export function hasPriceIncrease(input: {
  lastAmount: number | string | null
  prevAmount: number | string | null
}): boolean {
  const lastAmount = toNumber(input.lastAmount)
  const prevAmount = toNumber(input.prevAmount)
  return prevAmount > 0 && lastAmount > prevAmount
}

export function formatIncreaseDelta(input: {
  lastAmount: number | string | null
  prevAmount: number | string | null
}): string {
  const lastAmount = toNumber(input.lastAmount)
  const prevAmount = toNumber(input.prevAmount)

  if (prevAmount > 0) {
    const percent = ((lastAmount - prevAmount) / prevAmount) * 100
    const formattedPercent = Math.abs(percent) >= 10 ? percent.toFixed(0) : percent.toFixed(1)
    return `+${formattedPercent}%`
  }

  return `+ ${toCurrency(lastAmount)}`
}
