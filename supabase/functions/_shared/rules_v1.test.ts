import { describe, expect, it } from "vitest";
import { evaluateRulesV1, type CategoryRuleV1, type TransactionRuleInputV1 } from "./rules_v1";

const baseInput: TransactionRuleInputV1 = {
  accountId: "acc-1",
  amount: -42.5,
  merchantCanonical: "NETFLIX",
  merchantNormalized: "NETFLIX",
  descriptionShort: "Netflix charge",
  userCategorySource: null,
};

const rules: CategoryRuleV1[] = [
  {
    id: "contains",
    rule_type: "merchant_contains",
    merchant_pattern: "net",
    account_id: null,
    min_amount: null,
    max_amount: null,
    category_id: "cat-contains",
    is_active: true,
  },
  {
    id: "exact",
    rule_type: "merchant_exact",
    merchant_pattern: "netflix",
    account_id: null,
    min_amount: null,
    max_amount: null,
    category_id: "cat-exact",
    is_active: true,
  },
  {
    id: "account",
    rule_type: "merchant_contains_account",
    merchant_pattern: "netflix",
    account_id: "acc-1",
    min_amount: null,
    max_amount: null,
    category_id: "cat-account",
    is_active: true,
  },
  {
    id: "amount-range",
    rule_type: "merchant_contains_amount_range",
    merchant_pattern: "netflix",
    account_id: null,
    min_amount: 40,
    max_amount: 50,
    category_id: "cat-range",
    is_active: true,
  },
];

describe("evaluateRulesV1", () => {
  it("respects user override precedence", () => {
    const result = evaluateRulesV1({ ...baseInput, userCategorySource: "user" }, rules);
    expect(result.decision).toBe("user_override");
  });

  it("matches exact before other rule types", () => {
    const result = evaluateRulesV1(baseInput, rules);
    expect(result.decision).toBe("matched_rule");
    if (result.decision === "matched_rule") {
      expect(result.matchedRule.id).toBe("exact");
    }
  });

  it("matches account-scoped contains when exact is not available", () => {
    const withoutExact = rules.filter((rule) => rule.rule_type !== "merchant_exact");
    const result = evaluateRulesV1(baseInput, withoutExact);
    expect(result.decision).toBe("matched_rule");
    if (result.decision === "matched_rule") {
      expect(result.matchedRule.id).toBe("account");
    }
  });

  it("matches amount range rule before generic contains", () => {
    const scopedRules = rules.filter((rule) => rule.id !== "exact" && rule.id !== "account");
    const result = evaluateRulesV1(baseInput, scopedRules);
    expect(result.decision).toBe("matched_rule");
    if (result.decision === "matched_rule") {
      expect(result.matchedRule.id).toBe("amount-range");
    }
  });

  it("returns fallback suggestion when no rules match", () => {
    const result = evaluateRulesV1(
      { ...baseInput, merchantCanonical: "RANDOM SHOP", merchantNormalized: "RANDOM SHOP" },
      [],
    );
    expect(result.decision).toBe("fallback");
    if (result.decision === "fallback") {
      expect(result.fallbackSuggestion).toBe("expense");
    }
  });
});
