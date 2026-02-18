import type { RecurringKind } from "../_shared/merchant.ts";
import type { Cadence, RecurringCharge } from "../_shared/recurring.ts";

export type TxRow = {
  id: string;
  account_id: string;
  posted_at: string;
  amount: number | string;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  description_short: string;
  category_id: string | null;
  user_category_id: string | null;
};

export type MetricsRow = {
  user_id: string;
  day: string;
  spend_total: number;
  spend_weekend: number;
  spend_weekday: number;
  spend_after_20: number;
  spend_after_22: number;
  small_purchases_10_30: number;
  discretionary_spend: number;
};

export type SubscriptionClassification = "needs_review" | "subscription" | "bill_loan" | "transfer" | "ignore";

export type SubscriptionCandidate = {
  user_id: string;
  merchant_normalized: string;
  cadence: Cadence;
  confidence: number;
  classification: SubscriptionClassification;
  classification_rule_ref: string | null;
  classification_explanation: string | null;
  kind: RecurringKind;
  is_subscription: boolean;
  last_amount: number | null;
  prev_amount: number | null;
  last_charge_at: string | null;
  next_expected_at: string | null;
  occurrences: number;
};

export type RecurringClassificationRuleRow = {
  id: string;
  merchant_normalized: string;
  cadence: Cadence | null;
  min_amount: number | string | null;
  max_amount: number | string | null;
  classification: SubscriptionClassification;
  created_at: string;
};

export type TransactionRuleRow = {
  id: string;
  name: string;
  match_type: "contains" | "equals" | "regex";
  pattern: string;
  account_id: string | null;
  cadence: Cadence | null;
  min_amount: number | string | null;
  max_amount: number | string | null;
  target_amount: number | string | null;
  amount_tolerance_pct: number | string | null;
  set_merchant_normalized: string | null;
  set_pattern_classification: SubscriptionClassification | null;
  set_spending_category_id: string | null;
  explanation: string | null;
  priority: number;
  created_at: string;
};

export type EnrichedTxRow = TxRow & {
  effective_merchant: string;
  forced_pattern_classification: SubscriptionClassification | null;
  forced_pattern_cadence: Cadence | null;
  applied_rule_ref: string | null;
  applied_rule_explanation: string | null;
  applied_rule_priority: number | null;
  kind_hint: string | null;
  rule_forced_category_id: string | null;
  rule_forced_merchant: boolean;
};

export type AlertInsert = {
  user_id: string;
  alert_type: "unusual_charge" | "duplicate_charge" | "subscription_increase" | "pace_warning" | "bill_spike";
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  fingerprint: string;
  merchant_normalized: string | null;
  amount: number | null;
  metadata: Record<string, unknown>;
  reasoning: Record<string, unknown> | null;
};

export type GroupedRecurring = {
  charges: RecurringCharge[];
  kindHint: string | null;
  forcedDecisions: Array<{
    classification: SubscriptionClassification;
    cadence: Cadence | null;
    ruleRef: string | null;
    explanation: string | null;
    priority: number;
  }>;
};
