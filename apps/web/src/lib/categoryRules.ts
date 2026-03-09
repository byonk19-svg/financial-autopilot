/**
 * Maps spending category names to recurring pattern classifications.
 *
 * Used when "Fix everywhere" creates a transaction_rule so the Recurring page
 * automatically picks up the correct classification via set_pattern_classification.
 *
 * See: CATEGORY_TO_RECURRING_CLASSIFICATION in CLAUDE.md (Rule Engines section)
 */
export const CATEGORY_TO_RECURRING_CLASSIFICATION: Record<
  string,
  'subscription' | 'bill_loan' | 'transfer'
> = {
  'Streaming & Apps': 'subscription',
  'Utilities & Internet': 'bill_loan',
  Phone: 'bill_loan',
  'Mortgage & Housing': 'bill_loan',
  Insurance: 'bill_loan',
  'Loan Payment': 'bill_loan',
  'Childcare & School': 'bill_loan',
  Healthcare: 'bill_loan',
  'Credit Card Payment': 'transfer',
  'Savings Transfer': 'transfer',
  Investing: 'transfer',
}

/**
 * Infer a recurring classification from a category name.
 * Checks the exact map first, then falls back to keyword matching.
 * Returns null if no classification can be inferred.
 */
export function inferRecurringClassificationFromCategory(
  categoryName: string,
): 'subscription' | 'bill_loan' | 'transfer' | null {
  const exact = CATEGORY_TO_RECURRING_CLASSIFICATION[categoryName]
  if (exact) return exact

  const normalized = categoryName.trim().toLowerCase()
  if (!normalized) return null

  if (/(subscription|stream|app|membership|software|saas|media)/.test(normalized)) {
    return 'subscription'
  }

  if (
    /(utilit|internet|phone|mobile|mortgage|housing|insurance|loan|bill|childcare|school|health|medical)/.test(
      normalized,
    )
  ) {
    return 'bill_loan'
  }

  if (/(transfer|saving|invest|credit card payment|cc payment|autopay)/.test(normalized)) {
    return 'transfer'
  }

  return null
}
