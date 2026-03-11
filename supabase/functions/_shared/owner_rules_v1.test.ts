import { describe, expect, it } from "vitest";
import { evaluateOwnerRulesV1, type OwnerRuleV1, type TransactionOwnerRuleInputV1 } from "./owner_rules_v1";

const baseInput: TransactionOwnerRuleInputV1 = {
  accountId: "acc-1",
  amount: -42.5,
  merchantCanonical: "NETFLIX",
  merchantNormalized: "NETFLIX",
  descriptionShort: "Netflix charge",
};

const rules: OwnerRuleV1[] = [
  {
    id: "contains",
    rule_type: "merchant_contains",
    merchant_pattern: "net",
    account_id: null,
    min_amount: null,
    max_amount: null,
    set_owner: "household",
    is_active: true,
  },
  {
    id: "exact",
    rule_type: "merchant_exact",
    merchant_pattern: "netflix",
    account_id: null,
    min_amount: null,
    max_amount: null,
    set_owner: "elaine",
    is_active: true,
  },
  {
    id: "account",
    rule_type: "merchant_contains_account",
    merchant_pattern: "netflix",
    account_id: "acc-1",
    min_amount: null,
    max_amount: null,
    set_owner: "brianna",
    is_active: true,
  },
  {
    id: "amount-range",
    rule_type: "merchant_contains_amount_range",
    merchant_pattern: "netflix",
    account_id: null,
    min_amount: 40,
    max_amount: 50,
    set_owner: "household",
    is_active: true,
  },
];

describe("evaluateOwnerRulesV1", () => {
  it("matches exact before other rule types", () => {
    const result = evaluateOwnerRulesV1(baseInput, rules);
    expect(result.decision).toBe("matched_rule");
    if (result.decision === "matched_rule") {
      expect(result.matchedRule.id).toBe("exact");
      expect(result.matchedRule.set_owner).toBe("elaine");
    }
  });

  it("matches account-scoped contains when exact is not available", () => {
    const withoutExact = rules.filter((rule) => rule.rule_type !== "merchant_exact");
    const result = evaluateOwnerRulesV1(baseInput, withoutExact);
    expect(result.decision).toBe("matched_rule");
    if (result.decision === "matched_rule") {
      expect(result.matchedRule.id).toBe("account");
      expect(result.matchedRule.set_owner).toBe("brianna");
    }
  });

  it("matches amount range rule before generic contains", () => {
    const scopedRules = rules.filter((rule) => rule.id !== "exact" && rule.id !== "account");
    const result = evaluateOwnerRulesV1(baseInput, scopedRules);
    expect(result.decision).toBe("matched_rule");
    if (result.decision === "matched_rule") {
      expect(result.matchedRule.id).toBe("amount-range");
      expect(result.matchedRule.set_owner).toBe("household");
    }
  });

  it("returns no_match when no rules match", () => {
    const result = evaluateOwnerRulesV1(
      { ...baseInput, merchantCanonical: "RANDOM SHOP", merchantNormalized: "RANDOM SHOP" },
      [],
    );
    expect(result.decision).toBe("no_match");
  });
});
