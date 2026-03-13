import {
  evaluateOwnerRulesV1,
  type OwnerRuleV1,
  type OwnerValueV1,
  type TransactionOwnerRuleInputV1,
} from "../_shared/owner_rules_v1.ts";
import { evaluateRulesV1, type CategoryRuleV1, type TransactionRuleInputV1 } from "../_shared/rules_v1.ts";
import { HttpError } from "./request.ts";
import type {
  ImportedTransactionSnapshot,
  StoredTransactionForRules,
} from "./types.ts";

type AdminClient = {
  from: (table: string) => any;
};

export async function fetchCategoryRulesV1(
  adminClient: AdminClient,
  userId: string,
): Promise<CategoryRuleV1[]> {
  const { data, error } = await adminClient
    .from("transaction_category_rules_v1")
    .select("id, rule_type, merchant_pattern, account_id, min_amount, max_amount, category_id, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, "Could not load v1 transaction category rules.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    rule_type: row.rule_type,
    merchant_pattern: row.merchant_pattern,
    account_id: row.account_id,
    min_amount: row.min_amount === null ? null : Number(row.min_amount),
    max_amount: row.max_amount === null ? null : Number(row.max_amount),
    category_id: row.category_id,
    is_active: row.is_active === true,
    created_at: row.created_at ?? undefined,
  })) as CategoryRuleV1[];
}

export async function fetchOwnerRulesV1(
  adminClient: AdminClient,
  userId: string,
): Promise<OwnerRuleV1[]> {
  const { data, error } = await adminClient
    .from("transaction_owner_rules_v1")
    .select("id, rule_type, merchant_pattern, account_id, min_amount, max_amount, set_owner, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, "Could not load v1 transaction owner rules.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    rule_type: row.rule_type,
    merchant_pattern: row.merchant_pattern,
    account_id: row.account_id,
    min_amount: row.min_amount === null ? null : Number(row.min_amount),
    max_amount: row.max_amount === null ? null : Number(row.max_amount),
    set_owner: row.set_owner,
    is_active: row.is_active === true,
    created_at: row.created_at ?? undefined,
  })) as OwnerRuleV1[];
}

export async function getCategoryRulesV1ForUser(
  adminClient: AdminClient,
  userId: string,
  cache: Map<string, CategoryRuleV1[]>,
): Promise<CategoryRuleV1[]> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const loaded = await fetchCategoryRulesV1(adminClient, userId);
  cache.set(userId, loaded);
  return loaded;
}

export async function getOwnerRulesV1ForUser(
  adminClient: AdminClient,
  userId: string,
  cache: Map<string, OwnerRuleV1[]>,
): Promise<OwnerRuleV1[]> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const loaded = await fetchOwnerRulesV1(adminClient, userId);
  cache.set(userId, loaded);
  return loaded;
}

export async function applyCategoryRulesV1AfterImport(
  adminClient: AdminClient,
  userId: string,
  accountId: string,
  importedSnapshots: ImportedTransactionSnapshot[],
  rules: CategoryRuleV1[],
): Promise<number> {
  if (importedSnapshots.length === 0 || rules.length === 0) {
    return 0;
  }

  const snapshotByProviderId = new Map<string, ImportedTransactionSnapshot>();
  for (const snapshot of importedSnapshots) {
    snapshotByProviderId.set(snapshot.providerTransactionId, snapshot);
  }

  const providerIds = [...snapshotByProviderId.keys()];
  const batchSize = 250;
  let updatedCount = 0;

  for (let i = 0; i < providerIds.length; i += batchSize) {
    const providerBatch = providerIds.slice(i, i + batchSize);

    const { data, error } = await adminClient
      .from("transactions")
      .select(
        "id, provider_transaction_id, account_id, amount, owner, merchant_canonical, merchant_normalized, description_short, category_id, user_category_id, category_source, classification_rule_ref, classification_explanation",
      )
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .in("provider_transaction_id", providerBatch);

    if (error) {
      throw new HttpError(500, "Could not load transactions for v1 rule evaluation.");
    }

    for (const row of (data ?? []) as StoredTransactionForRules[]) {
      const imported = snapshotByProviderId.get(row.provider_transaction_id);
      if (!imported) continue;

      const input: TransactionRuleInputV1 = {
        accountId: imported.accountId,
        amount: imported.amount,
        merchantCanonical: imported.merchantCanonical ?? row.merchant_canonical,
        merchantNormalized: imported.merchantNormalized ?? row.merchant_normalized,
        descriptionShort: imported.descriptionShort || row.description_short || "Transaction",
        userCategorySource: row.category_source,
      };

      const result = evaluateRulesV1(input, rules);
      if (result.decision !== "matched_rule") continue;

      const matchedRuleRef = `category_rule_v1:${result.matchedRule.id}`;
      const nextCategoryId = result.matchedRule.category_id;
      const shouldUpdate =
        row.category_id !== nextCategoryId ||
        row.user_category_id !== nextCategoryId ||
        row.category_source !== "rule" ||
        row.classification_rule_ref !== matchedRuleRef ||
        row.classification_explanation !== result.reason;

      if (!shouldUpdate) continue;

      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          category_id: nextCategoryId,
          user_category_id: nextCategoryId,
          category_source: "rule",
          classification_rule_ref: matchedRuleRef,
          classification_explanation: result.reason,
        })
        .eq("id", row.id)
        .eq("user_id", userId)
        .neq("category_source", "user");

      if (updateError) {
        throw new HttpError(500, "Could not apply v1 category rule to imported transactions.");
      }

      updatedCount += 1;
    }
  }

  return updatedCount;
}

export async function applyOwnerRulesV1AfterImport(
  adminClient: AdminClient,
  userId: string,
  accountId: string,
  importedSnapshots: ImportedTransactionSnapshot[],
  rules: OwnerRuleV1[],
): Promise<number> {
  if (importedSnapshots.length === 0 || rules.length === 0) {
    return 0;
  }

  const snapshotByProviderId = new Map<string, ImportedTransactionSnapshot>();
  for (const snapshot of importedSnapshots) {
    snapshotByProviderId.set(snapshot.providerTransactionId, snapshot);
  }

  const providerIds = [...snapshotByProviderId.keys()];
  const batchSize = 250;
  let updatedCount = 0;

  for (let i = 0; i < providerIds.length; i += batchSize) {
    const providerBatch = providerIds.slice(i, i + batchSize);

    const { data, error } = await adminClient
      .from("transactions")
      .select(
        "id, provider_transaction_id, account_id, amount, owner, merchant_canonical, merchant_normalized, description_short, category_id, user_category_id, category_source, classification_rule_ref, classification_explanation",
      )
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .in("provider_transaction_id", providerBatch);

    if (error) {
      throw new HttpError(500, "Could not load transactions for owner rule evaluation.");
    }

    for (const row of (data ?? []) as StoredTransactionForRules[]) {
      const imported = snapshotByProviderId.get(row.provider_transaction_id);
      if (!imported) continue;

      const input: TransactionOwnerRuleInputV1 = {
        accountId: imported.accountId,
        amount: imported.amount,
        merchantCanonical: imported.merchantCanonical ?? row.merchant_canonical,
        merchantNormalized: imported.merchantNormalized ?? row.merchant_normalized,
        descriptionShort: imported.descriptionShort || row.description_short || "Transaction",
      };

      const result = evaluateOwnerRulesV1(input, rules);
      if (result.decision !== "matched_rule") continue;

      const nextOwner = result.matchedRule.set_owner as OwnerValueV1;
      if (row.owner === nextOwner) continue;

      const { error: updateError } = await adminClient
        .from("transactions")
        .update({ owner: nextOwner })
        .eq("id", row.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new HttpError(500, "Could not apply v1 owner rule to imported transactions.");
      }

      updatedCount += 1;
    }
  }

  return updatedCount;
}
