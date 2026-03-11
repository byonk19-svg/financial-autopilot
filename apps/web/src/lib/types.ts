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
  type?: 'income' | 'expense' | 'transfer' | 'savings' | null
  category?: string | null
  owner?: OwnerValue
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
  is_hidden?: boolean
  is_pending?: boolean
}

export type OwnerValue = 'brianna' | 'elaine' | 'household' | 'unknown'

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
  primary_payer?: OwnerValue
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

export type EmployerPaySchedule = 'weekly' | 'biweekly' | 'semimonthly'

export type EmployerRecord = {
  id: string
  user_id: string
  name: string
  short_code: string
  color: string
  pay_schedule: EmployerPaySchedule
  pay_lag_days: number
  pto_policy_hours_per_hour: number | null
  is_active: boolean
}

export type EmployerLocationRecord = {
  id: string
  user_id: string
  employer_id: string
  name: string
  short_code: string
  is_active: boolean
}

export type ShiftRecord = {
  id: string
  user_id: string
  shift_date: string
  employer_id: string
  location_id: string | null
  hours_worked: number | string
  gross_pay: number | string
  notes: string | null
  is_non_pay: boolean
  created_at: string
}

export type ShiftWeek = {
  key: string
  weekStart: string
  weekEnd: string
  shifts: ShiftRecord[]
}

export type ShiftWeekEmployerSummary = {
  hours: number
  pay: number
}

export type ShiftWeekSummary = {
  totalHours: number
  totalPay: number
  avgRate: number
  stillNeed: number
  goalMet: boolean
  byEmployer: Record<string, ShiftWeekEmployerSummary>
  ptoAccrued: Record<string, number>
}

export type CashFlowTransaction = {
  id: string
  posted_at: string
  amount: number | string
  description_short: string
  merchant_canonical: string | null
  merchant_normalized: string | null
}

export type CashFlowBillTemplate = {
  id: string
  user_id: string
  name: string
  amount: number | string
  due_day_of_month: number
  account_id: string | null
  category: 'bill' | 'expense' | 'transfer'
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CashFlowProjectedIncome = {
  id: string
  user_id: string
  expected_date: string
  amount: number | string
  description: string
  employer_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MonthBalanceRecord = {
  user_id: string
  month_key: string
  opening_balance: number | string
  low_balance_threshold: number | string
  created_at: string
  updated_at: string
}

export type CashFlowLedgerEntryCategory = 'income' | 'bill' | 'transfer' | 'expense' | 'dividend'

export type CashFlowLedgerEntry = {
  id: string
  date: string
  amount: number
  description: string
  category: CashFlowLedgerEntryCategory | string
  isProjected: boolean
  billTemplateId?: string | null
  employerId?: string | null
  color?: string | null
}

export type CashFlowLedgerDay = {
  date: string
  entries: CashFlowLedgerEntry[]
  dayTotal: number
  runningBalance: number
  isProjected: boolean
  isToday: boolean
  isBelowThreshold: boolean
}

// Utility type for numeric values returned from Supabase RPC (may be number, string, null, or undefined)
export type NumberLike = number | string | null | undefined

// --- Shift log RPC shapes (used by Dashboard) ---

export type ShiftSummaryRow = {
  shift_id: string
  employer_name: string
  location_name: string | null
  shift_date: string
  clock_in: string | null
  clock_out: string | null
  hours_worked: NumberLike
  gross_pay: NumberLike
  status: string
}

export type ShiftBreakdownRow = {
  employer_name: string
  hours: NumberLike
  gross_pay: NumberLike
}

export type ShiftWeekSummaryRpc = {
  week_start: string
  week_end: string
  shifts: ShiftSummaryRow[] | null
  total_hours: NumberLike
  total_gross_pay: NumberLike
  employer_breakdown: ShiftBreakdownRow[] | null
}

// --- Savings bucket RPC shapes (used by Dashboard) ---

export type SavingsBucketSummaryRow = {
  bucket_id: string
  name: string
  owner: 'brianna' | 'elaine' | 'household'
  target_amount: NumberLike
  current_balance: NumberLike
  allocation_pct: NumberLike
  weekly_target: NumberLike
  goal_date: string | null
  priority: number
  progress_pct: NumberLike
  weeks_to_goal: number | null
}

export type SavingsBucketRow = {
  bucket_id: string
  name: string
  owner: 'brianna' | 'elaine' | 'household'
  target_amount: number | null
  current_balance: number | string | null
  progress_pct: number | null
  weeks_to_goal: number | null
}

export type SavingsBucketSummaryRpc = {
  buckets: SavingsBucketRow[] | null
  total_saved: NumberLike
  total_by_owner: {
    brianna?: NumberLike
    elaine?: NumberLike
    household?: NumberLike
  } | null
}

// --- Account / Overview types ---

export type AccountRow = {
  id: string
  name: string
  institution: string | null
  type: string
  is_credit: boolean
  owner: 'brianna' | 'elaine' | 'household'
  balance: number | string | null
  available_balance: number | string | null
  currency: string
}

export type AccountGroup = {
  label: string
  accounts: AccountRow[]
  total: number
  isDebt: boolean
}

// --- Alert types ---

export type AlertRow = {
  id: string
  alert_type:
    | 'unusual_charge'
    | 'duplicate_charge'
    | 'subscription_increase'
    | 'pace_warning'
    | 'bill_spike'
    | 'subscription_renewal'
  severity: 'low' | 'medium' | 'high'
  title: string
  body: string
  merchant_normalized: string | null
  amount: number | string | null
  reasoning: Record<string, unknown> | null
  created_at: string
  read_at: string | null
  is_dismissed: boolean
}

export type AlertSeverityFilter = 'all' | AlertRow['severity']
export type AlertTypeFilter = 'all' | AlertRow['alert_type']

export type AlertFeedbackRow = {
  alert_type: AlertRow['alert_type']
  merchant_canonical: string
  is_expected: boolean
  created_at: string
}

export type AlertFeedback = {
  isExpected: boolean
  createdAt: string
}

export type AlertFeedbackMap = Record<string, AlertFeedback>

// --- Transaction feature types ---

export type SortColumn = 'posted_at' | 'amount' | 'merchant_normalized'
export type SortDirection = 'asc' | 'desc'
export type TransactionViewPreset = 'all' | 'elaine_income' | 'household_bills' | 'brianna_savings'
export type RuleMatchType = 'equals' | 'contains'
export type RuleApplyScope = 'future_only' | 'past_90_days' | 'all_history'

export type TransactionSplitRow = {
  id: string
  transaction_id: string
  category_id: string | null
  amount: number | string
  memo: string | null
}

export type TransactionSplitDraftLine = {
  draft_id: string
  id?: string
  category_id: string | null
  amount_input: string
  memo: string
}

export type CreateRuleFormState = {
  canonicalMerchant: string
  matchType: RuleMatchType
  constrainToAccount: boolean
  categoryId: string
  applyScope: RuleApplyScope
}

export type CategoryFollowUpAction = 'apply_similar' | 'apply_and_rule' | null

export type CategoryFollowUpPromptState = {
  transactionId: string
  merchantCanonical: string
  accountId: string
  categoryId: string
  categoryName: string
  includeAccountScope: boolean
  pendingAction: CategoryFollowUpAction
}

export type HideFollowUpState = {
  transactionId: string
  merchantCanonical: string
  accountId: string
  includeAccountScope: boolean
  pending: boolean
}

export type TransactionToast = {
  id: number
  message: string
  tone: 'error' | 'info'
  link?: { href: string; label: string }
}
