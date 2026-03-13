import type { OwnerValue, TransactionRow, TransactionViewPreset } from '@/lib/types'

export const UNCATEGORIZED_VALUE = '__uncategorized__'

export const TRANSACTION_VIEW_PRESETS: Array<{ value: TransactionViewPreset; label: string }> = [
  { value: 'all', label: 'All Transactions' },
  { value: 'elaine_income', label: "Elaine's Income" },
  { value: 'household_bills', label: 'Household Bills' },
  { value: 'brianna_savings', label: "Brianna's Savings" },
]

export const PAGE_SIZE = 50

export const FALLBACK_CATEGORY_NAMES = [
  'Payroll - Brianna',
  'Payroll - Elaine',
  'Other Income',
  'Groceries',
  'Dining & Restaurants',
  'Streaming & Apps',
  'Shopping',
  'Utilities & Internet',
  'Phone',
  'Mortgage & Housing',
  'Auto & Gas',
  'Healthcare',
  'Fertility - Progyny',
  'Pharmacy',
  'Insurance',
  'Investing',
  'Savings Transfer',
  'Credit Card Payment',
  'Loan Payment',
  'Childcare & School',
  'Pet',
  'Travel',
  'Fees & Charges',
  'Cash & ATM',
  'Other',
] as const

export const TRANSACTION_VIEW_PRESET_LABELS: Record<
  Exclude<TransactionViewPreset, 'all'>,
  string
> = {
  elaine_income: "View: Elaine's Income",
  household_bills: 'View: Household Bills',
  brianna_savings: "View: Brianna's Savings",
}

export function parseAmount(value: number | string): number {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function resolveRuleId(transaction: TransactionRow): string | null {
  if (transaction.rule_id) return transaction.rule_id
  const ref = transaction.classification_rule_ref
  if (!ref) return null
  const prefix = 'transaction_rule:'
  if (!ref.startsWith(prefix)) return null
  const possibleId = ref.slice(prefix.length)
  return possibleId.length > 0 ? possibleId : null
}

export function parseAmountInput(value: string): number {
  const parsed = Number.parseFloat(value.trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function isSplitTotalValid(total: number, amount: number): boolean {
  return Math.abs(total - amount) < 0.005
}

export function toEndOfDayIso(value: string): string {
  return `${value}T23:59:59.999Z`
}

export function toStartOfDayIso(value: string): string {
  return `${value}T00:00:00.000Z`
}

export function buildSearchAndCategoryOrFilter(categoryId: string, searchQuery: string): string | null {
  let categoryPredicates: string[]
  if (categoryId === UNCATEGORIZED_VALUE) {
    categoryPredicates = ['and(user_category_id.is.null,category_id.is.null)']
  } else if (categoryId) {
    categoryPredicates = [
      `user_category_id.eq.${categoryId}`,
      `and(user_category_id.is.null,category_id.eq.${categoryId})`,
    ]
  } else {
    categoryPredicates = []
  }

  const searchPredicates = searchQuery
    ? [
        `merchant_normalized.ilike.%${searchQuery}%`,
        `description_short.ilike.%${searchQuery}%`,
      ]
    : []

  if (categoryPredicates.length && searchPredicates.length) {
    return categoryPredicates
      .flatMap((categoryPredicate) =>
        searchPredicates.map((searchPredicate) => `and(${categoryPredicate},${searchPredicate})`),
      )
      .join(',')
  }

  if (categoryPredicates.length) return categoryPredicates.join(',')
  if (searchPredicates.length) return searchPredicates.join(',')
  return null
}

export function detectCanonicalMerchant(transaction: TransactionRow): string {
  return (
    transaction.merchant_canonical ??
    transaction.merchant_normalized ??
    transaction.description_short ??
    ''
  ).trim()
}

export function createSplitDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

export function isDuplicateAutoRuleError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').includes('uq_transaction_category_rules_v1_signature')
}

export function isDuplicateOwnerAutoRuleError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').includes('uq_transaction_owner_rules_v1_signature')
}

export function isOwnerRuleTarget(owner: OwnerValue | undefined): owner is Exclude<OwnerValue, 'unknown'> {
  return owner === 'brianna' || owner === 'elaine' || owner === 'household'
}
