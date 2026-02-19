export type RuleTypeV1 =
  | "merchant_contains"
  | "merchant_exact"
  | "merchant_contains_account"
  | "merchant_contains_amount_range";

export type CategoryRuleV1 = {
  id: string;
  rule_type: RuleTypeV1;
  merchant_pattern: string;
  account_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  category_id: string;
  is_active: boolean;
  created_at?: string;
};

export type TransactionRuleInputV1 = {
  accountId: string;
  amount: number;
  merchantCanonical: string | null;
  merchantNormalized: string | null;
  descriptionShort: string;
  userCategorySource: "user" | "rule" | "auto" | "import" | "unknown" | null;
};

export type RuleMatchResultV1 =
  | {
    decision: "user_override";
    matchedRule: null;
    reason: string;
    fallbackSuggestion: string | null;
  }
  | {
    decision: "matched_rule";
    matchedRule: CategoryRuleV1;
    reason: string;
    fallbackSuggestion: null;
  }
  | {
    decision: "fallback";
    matchedRule: null;
    reason: string;
    fallbackSuggestion: string | null;
  };

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMerchantHaystack(input: TransactionRuleInputV1): string {
  const merchant = input.merchantCanonical ?? input.merchantNormalized ?? input.descriptionShort;
  return normalizeText(merchant);
}

function isWithinAmountRange(amount: number, min: number | null, max: number | null): boolean {
  const absAmount = Math.abs(amount);
  if (min !== null && absAmount < min) return false;
  if (max !== null && absAmount > max) return false;
  return true;
}

function bySpecificPatternLengthDesc(a: CategoryRuleV1, b: CategoryRuleV1): number {
  const aLen = normalizeText(a.merchant_pattern).length;
  const bLen = normalizeText(b.merchant_pattern).length;
  if (aLen !== bLen) return bLen - aLen;
  return a.id.localeCompare(b.id);
}

function pickFirstMatch(
  rules: CategoryRuleV1[],
  matcher: (rule: CategoryRuleV1) => boolean,
): CategoryRuleV1 | null {
  const sorted = [...rules].sort(bySpecificPatternLengthDesc);
  for (const rule of sorted) {
    if (!rule.is_active) continue;
    if (matcher(rule)) return rule;
  }
  return null;
}

function suggestFallbackCategory(haystack: string, amount: number): string | null {
  if (amount > 0) return "income";

  const transferTerms = ["transfer", "xfer", "zelle", "venmo", "cash app", "ach"];
  if (transferTerms.some((term) => haystack.includes(term))) return "transfer";

  const billTerms = ["mortgage", "rent", "insurance", "comcast", "xfinity", "electric", "water", "gas", "loan"];
  if (billTerms.some((term) => haystack.includes(term))) return "bill";

  return "expense";
}

export function evaluateRulesV1(
  input: TransactionRuleInputV1,
  rules: CategoryRuleV1[],
): RuleMatchResultV1 {
  if (input.userCategorySource === "user") {
    return {
      decision: "user_override",
      matchedRule: null,
      reason: "Skipped rule matching because transaction has a user override.",
      fallbackSuggestion: null,
    };
  }

  const haystack = getMerchantHaystack(input);
  const activeRules = rules.filter((rule) => rule.is_active);

  const exactMatch = pickFirstMatch(
    activeRules.filter((rule) => rule.rule_type === "merchant_exact"),
    (rule) => haystack === normalizeText(rule.merchant_pattern),
  );
  if (exactMatch) {
    return {
      decision: "matched_rule",
      matchedRule: exactMatch,
      reason: "Matched merchant_exact rule.",
      fallbackSuggestion: null,
    };
  }

  const accountMatch = pickFirstMatch(
    activeRules.filter((rule) => rule.rule_type === "merchant_contains_account"),
    (rule) =>
      rule.account_id === input.accountId &&
      haystack.includes(normalizeText(rule.merchant_pattern)),
  );
  if (accountMatch) {
    return {
      decision: "matched_rule",
      matchedRule: accountMatch,
      reason: "Matched merchant_contains + account_id rule.",
      fallbackSuggestion: null,
    };
  }

  const amountRangeMatch = pickFirstMatch(
    activeRules.filter((rule) => rule.rule_type === "merchant_contains_amount_range"),
    (rule) =>
      haystack.includes(normalizeText(rule.merchant_pattern)) &&
      isWithinAmountRange(input.amount, rule.min_amount, rule.max_amount),
  );
  if (amountRangeMatch) {
    return {
      decision: "matched_rule",
      matchedRule: amountRangeMatch,
      reason: "Matched merchant_contains + amount_range rule.",
      fallbackSuggestion: null,
    };
  }

  const containsMatch = pickFirstMatch(
    activeRules.filter((rule) => rule.rule_type === "merchant_contains"),
    (rule) => haystack.includes(normalizeText(rule.merchant_pattern)),
  );
  if (containsMatch) {
    return {
      decision: "matched_rule",
      matchedRule: containsMatch,
      reason: "Matched merchant_contains rule.",
      fallbackSuggestion: null,
    };
  }

  return {
    decision: "fallback",
    matchedRule: null,
    reason: "No v1 rule matched; using heuristic fallback suggestion.",
    fallbackSuggestion: suggestFallbackCategory(haystack, input.amount),
  };
}
