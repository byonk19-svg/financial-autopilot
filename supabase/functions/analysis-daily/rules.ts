import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  compileMerchantAliases,
  findMerchantAlias,
  normalizeMerchantForRecurring,
  type MerchantAliasMatcher,
  type MerchantAliasRow,
} from "../_shared/merchant.ts";
import type { EnrichedTxRow, TransactionRuleRow, TxRow } from "./types.ts";
import { matchesRulePattern, normalizeMatchInput, toNumber, clamp } from "./utils.ts";

export async function fetchTransactionRules(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<TransactionRuleRow[]> {
  const { data, error } = await admin
    .from("transaction_rules")
    .select(
      "id, name, match_type, pattern, account_id, cadence, min_amount, max_amount, target_amount, amount_tolerance_pct, set_merchant_normalized, set_pattern_classification, set_spending_category_id, set_is_hidden, explanation, priority, created_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Could not load transaction rules.");
  }

  return (data ?? []) as TransactionRuleRow[];
}

export async function fetchMerchantAliasMatchers(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<MerchantAliasMatcher[]> {
  const [userAliasesResult, globalAliasesResult] = await Promise.all([
    admin
      .from("merchant_aliases")
      .select("id, user_id, account_id, match_type, pattern, normalized, kind_hint, priority")
      .eq("is_active", true)
      .eq("user_id", userId)
      .order("priority", { ascending: true })
      .order("id", { ascending: true }),
    admin
      .from("merchant_aliases")
      .select("id, user_id, account_id, match_type, pattern, normalized, kind_hint, priority")
      .eq("is_active", true)
      .is("user_id", null)
      .order("priority", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (userAliasesResult.error || globalAliasesResult.error) {
    // Keep analysis running even if alias table is unavailable.
    console.log(JSON.stringify({ warning: "merchant_aliases_unavailable", user_id: userId }));
    return [];
  }

  const aliases = [
    ...(userAliasesResult.data ?? []),
    ...(globalAliasesResult.data ?? []),
  ] as MerchantAliasRow[];

  return compileMerchantAliases(aliases);
}

export function matchTransactionRule(tx: TxRow, rules: TransactionRuleRow[]): TransactionRuleRow | null {
  const absAmount = Math.abs(toNumber(tx.amount));
  const haystack = normalizeMatchInput(
    `${tx.merchant_canonical ?? ""} ${tx.merchant_normalized ?? ""} ${tx.description_short}`,
  );

  for (const rule of rules) {
    if (rule.account_id && rule.account_id !== tx.account_id) continue;

    if (rule.min_amount !== null && absAmount < toNumber(rule.min_amount)) continue;
    if (rule.max_amount !== null && absAmount > toNumber(rule.max_amount)) continue;

    if (rule.target_amount !== null && rule.amount_tolerance_pct !== null) {
      const target = toNumber(rule.target_amount);
      const pct = clamp(toNumber(rule.amount_tolerance_pct), 0, 1);
      const lower = target * (1 - pct);
      const upper = target * (1 + pct);
      if (absAmount < lower || absAmount > upper) continue;
    }

    if (!matchesRulePattern(rule.match_type, rule.pattern, haystack)) continue;

    return rule;
  }

  return null;
}

export function applyRulesToTransactions(
  txRows: TxRow[],
  aliases: MerchantAliasMatcher[],
  rules: TransactionRuleRow[],
): EnrichedTxRow[] {
  const enriched: EnrichedTxRow[] = [];

  for (const tx of txRows) {
    const alias = findMerchantAlias(
      [tx.merchant_canonical, tx.merchant_normalized, tx.description_short],
      aliases,
      tx.account_id,
    );
    const matchedRule = matchTransactionRule(tx, rules);

    const baseMerchant = matchedRule?.set_merchant_normalized?.trim() ||
      alias?.normalized ||
      tx.merchant_canonical ||
      tx.merchant_normalized ||
      tx.description_short;
    const effectiveMerchant = normalizeMerchantForRecurring(baseMerchant);

    const aliasRef = alias ? `merchant_alias:${alias.id}` : null;
    const aliasExplanation = alias ? `Matched merchant alias pattern "${alias.pattern}".` : null;
    const ruleRef = matchedRule ? `transaction_rule:${matchedRule.id}` : aliasRef;
    const ruleExplanation = matchedRule
      ? matchedRule.explanation?.trim() || `Matched transaction rule "${matchedRule.name}".`
      : aliasExplanation;

    enriched.push({
      ...tx,
      merchant_canonical: tx.merchant_canonical ?? null,
      merchant_normalized: tx.merchant_normalized ?? null,
      user_category_id: matchedRule?.set_spending_category_id ?? tx.user_category_id,
      effective_merchant: effectiveMerchant,
      forced_pattern_classification: matchedRule?.set_pattern_classification ?? null,
      forced_pattern_cadence: matchedRule?.cadence ?? null,
      applied_rule_ref: ruleRef,
      applied_rule_explanation: ruleExplanation,
      applied_rule_priority: matchedRule?.priority ?? null,
      kind_hint: alias?.kind_hint ?? null,
      rule_forced_category_id: matchedRule?.set_spending_category_id ?? null,
      rule_forced_merchant: Boolean(matchedRule?.set_merchant_normalized?.trim() || alias?.normalized),
      rule_forced_hidden: matchedRule?.set_is_hidden === true,
    });
  }

  return enriched;
}

export async function persistTransactionRuleMatches(
  admin: ReturnType<typeof createClient>,
  userId: string,
  txRows: EnrichedTxRow[],
): Promise<void> {
  const matchedRows = txRows.filter((row) => row.applied_rule_ref !== null);
  if (matchedRows.length === 0) return;

  for (const row of matchedRows) {
    const updatePayload: {
      classification_rule_ref: string | null;
      classification_explanation: string | null;
      user_category_id?: string | null;
      merchant_canonical?: string | null;
      merchant_normalized?: string | null;
      is_hidden?: boolean;
    } = {
      classification_rule_ref: row.applied_rule_ref,
      classification_explanation: row.applied_rule_explanation,
    };

    if (row.rule_forced_category_id) {
      updatePayload.user_category_id = row.rule_forced_category_id;
    }

    if (row.rule_forced_merchant && row.effective_merchant && row.effective_merchant !== "UNKNOWN") {
      updatePayload.merchant_canonical = row.effective_merchant;
      updatePayload.merchant_normalized = row.effective_merchant;
    }

    if (row.rule_forced_hidden) {
      updatePayload.is_hidden = true;
    }

    const { error } = await admin
      .from("transactions")
      .update(updatePayload)
      .eq("id", row.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error("Could not persist transaction rule attribution.");
    }
  }
}
