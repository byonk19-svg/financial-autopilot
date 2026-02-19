type DateLike = string | number | Date | null | undefined

export const NUMERIC_ALIGN_CLASS = "tabular-nums text-right"

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  return safeAmount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatShortDate(dateLike: DateLike): string {
  const date = toDate(dateLike)
  if (!date) return "—"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function formatShortDateTime(dateLike: DateLike): string {
  const date = toDate(dateLike)
  if (!date) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
