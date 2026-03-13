import { describe, expect, it } from "vitest";
import { getCategoryRulesV1ForUser } from "./rules.ts";

function createRuleClient() {
  let calls = 0;
  const response = {
    data: [{
      id: "rule-1",
      rule_type: "contains",
      merchant_pattern: "starbucks",
      account_id: null,
      min_amount: null,
      max_amount: null,
      category_id: "cat-1",
      is_active: true,
      created_at: "2026-03-12T00:00:00.000Z",
    }],
    error: null,
  };

  const chain = {
    select() {
      calls += 1;
      return chain;
    },
    eq() {
      return chain;
    },
    then(resolve: (value: typeof response) => unknown) {
      return Promise.resolve(resolve(response));
    },
  };

  return {
    client: {
      from() {
        return chain;
      },
    },
    getCalls() {
      return calls;
    },
  };
}

describe("getCategoryRulesV1ForUser", () => {
  it("uses the cache after the first fetch", async () => {
    const { client, getCalls } = createRuleClient();
    const cache = new Map();

    const first = await getCategoryRulesV1ForUser(client, "user-1", cache);
    const second = await getCategoryRulesV1ForUser(client, "user-1", cache);

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(getCalls()).toBe(1);
  });
});
