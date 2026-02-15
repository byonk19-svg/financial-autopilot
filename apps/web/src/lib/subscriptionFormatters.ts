export type SubscriptionCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'
export type DensityMode = 'comfortable' | 'compact'

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
