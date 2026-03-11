export type OwnerRuleTypeV1 =
  | "merchant_contains"
  | "merchant_exact"
  | "merchant_contains_account"
  | "merchant_contains_amount_range";

export type OwnerValueV1 = "brianna" | "elaine" | "household";

export type OwnerRuleV1 = {
  id: string;
  rule_type: OwnerRuleTypeV1;
  merchant_pattern: string;
  account_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  set_owner: OwnerValueV1;
  is_active: boolean;
  created_at?: string;
};

export type TransactionOwnerRuleInputV1 = {
  accountId: string;
  amount: number;
  merchantCanonical: string | null;
  merchantNormalized: string | null;
  descriptionShort: string;
};

export type OwnerRuleMatchResultV1 =
  | {
    decision: "matched_rule";
    matchedRule: OwnerRuleV1;
    reason: string;
  }
  | {
    decision: "no_match";
    matchedRule: null;
    reason: string;
  };

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMerchantHaystack(input: TransactionOwnerRuleInputV1): string {
  const merchant = input.merchantCanonical ?? input.merchantNormalized ?? input.descriptionShort;
  return normalizeText(merchant);
}

function isWithinAmountRange(amount: number, min: number | null, max: number | null): boolean {
  const absAmount = Math.abs(amount);
  if (min !== null && absAmount < min) return false;
  if (max !== null && absAmount > max) return false;
  return true;
}

function bySpecificPatternLengthDesc(a: OwnerRuleV1, b: OwnerRuleV1): number {
  const aLen = normalizeText(a.merchant_pattern).length;
  const bLen = normalizeText(b.merchant_pattern).length;
  if (aLen !== bLen) return bLen - aLen;
  return a.id.localeCompare(b.id);
}

function pickFirstMatch(
  rules: OwnerRuleV1[],
  matcher: (rule: OwnerRuleV1) => boolean,
): OwnerRuleV1 | null {
  const sorted = [...rules].sort(bySpecificPatternLengthDesc);
  for (const rule of sorted) {
    if (!rule.is_active) continue;
    if (matcher(rule)) return rule;
  }
  return null;
}

export function evaluateOwnerRulesV1(
  input: TransactionOwnerRuleInputV1,
  rules: OwnerRuleV1[],
): OwnerRuleMatchResultV1 {
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
      reason: "Matched owner merchant_exact rule.",
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
      reason: "Matched owner merchant_contains + account_id rule.",
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
      reason: "Matched owner merchant_contains + amount_range rule.",
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
      reason: "Matched owner merchant_contains rule.",
    };
  }

  return {
    decision: "no_match",
    matchedRule: null,
    reason: "No v1 owner rule matched.",
  };
}
