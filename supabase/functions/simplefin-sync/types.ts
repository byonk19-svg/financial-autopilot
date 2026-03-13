export type ConnectionRow = {
  id: string;
  user_id: string;
  token_enc: string | null;
  token_kid: string | null;
};

export type AccountRow = {
  id: string;
};

export type UserPreference = {
  rawDescriptionDays: number;
  retentionMonths: number;
};

export type ImportedTransactionSnapshot = {
  accountId: string;
  providerTransactionId: string;
  amount: number;
  merchantCanonical: string | null;
  merchantNormalized: string | null;
  descriptionShort: string;
};

export type StoredTransactionForRules = {
  id: string;
  provider_transaction_id: string;
  account_id: string;
  amount: number | string;
  owner: string | null;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  description_short: string;
  category_id: string | null;
  user_category_id: string | null;
  category_source: "user" | "rule" | "auto" | "import" | "unknown" | null;
  classification_rule_ref: string | null;
  classification_explanation: string | null;
};

export type TransactionMatchRow = {
  id: string;
  posted_at: string;
  authorized_at: string | null;
  amount: number | string;
  merchant_canonical: string | null;
  merchant_normalized: string | null;
  description_short: string;
};
