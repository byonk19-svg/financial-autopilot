export type AccountOption = {
  id: string
  name: string
}

export type CategoryOption = {
  id: string
  name: string
}

export type TransactionRow = {
  id: string
  account_id: string
  category_id: string | null
  user_category_id: string | null
  category_source?: string | null
  rule_id?: string | null
  classification_rule_ref?: string | null
  posted_at: string
  merchant_canonical?: string | null
  merchant_normalized: string | null
  description_short: string
  description_full?: string | null
  amount: number | string
  currency: string
}

export type InsightType = 'pattern' | 'opportunity' | 'warning' | 'projection'

export type Insight = {
  id: string
  type: InsightType
  title: string
  body: string
  week_of: string
  created_at: string
  is_read: boolean
  is_dismissed: boolean
}

export type SubscriptionCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'
export type SubscriptionClassification = 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore'

export type SubscriptionRecord = {
  id: string
  merchant_normalized: string
  cadence: SubscriptionCadence
  classification: SubscriptionClassification
  is_false_positive: boolean
  user_locked: boolean
  notify_days_before: number | null
  last_amount: number | string | null
  prev_amount: number | string | null
  next_expected_at: string | null
  confidence: number | string
  is_active: boolean
}

export type SubscriptionHistoryRow = {
  id: string
  posted_at: string
  amount: number | string
  description_short: string
  merchant_canonical: string | null
  merchant_normalized: string | null
  account_id: string
  account_name: string | null
  category_id: string | null
}
