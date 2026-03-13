import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getCronSecret, getSimplefinConfig, getSupabaseConfig } from "../_shared/env.ts";
import { addDays, asRecord, parseAccountsPayload, parseTransactions, pickNumber, pickString, toIsoDate } from "./payload.ts";
import { ALLOW_HEADERS, ALLOW_METHODS, errorInfo, getBearerToken, HttpError, isCronRequest, json, parseSyncRequestOptions } from "./request.ts";
import { fetchAccounts } from "../_shared/simplefin.ts";
import { buildBackfillWindowsExclusive } from "../_shared/simplefin_backfill.ts";
import {
  DEFAULT_LOOKBACK_DAYS,
  type SyncRequestOptions,
} from "../_shared/simplefin_sync_options.ts";
import {
  forceArchivePendingTransactions,
  reconcileStalePendingTransactions,
} from "./pending.ts";
import {
  applyCategoryRulesV1AfterImport,
  applyOwnerRulesV1AfterImport,
  getCategoryRulesV1ForUser,
  getOwnerRulesV1ForUser,
} from "./rules.ts";
import {
  decryptAccessUrl,
  getRawDescriptionDaysMap,
  getTransactionCountForUser,
  upsertAccount,
  upsertTransactions,
} from "./storage.ts";
import { addCalendarDays, normalizeCanonicalMerchant, normalizeMerchantForSearch, toUnixSeconds, truncate } from "./syncHelpers.ts";
import type { ConnectionRow, ImportedTransactionSnapshot } from "./types.ts";
import type { CategoryRuleV1 } from "../_shared/rules_v1.ts";
import type { OwnerRuleV1 } from "../_shared/owner_rules_v1.ts";

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } =
  getSupabaseConfig();
const { encKey: SIMPLEFIN_ENC_KEY, keyByKid: SIMPLEFIN_KEYS_BY_KID } = getSimplefinConfig();
const CRON_SECRET = getCronSecret();
const FUNCTION_NAME = "simplefin-sync";


async function getManualUserId(jwt: string): Promise<string> {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await authClient.auth.getUser(jwt);
  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized.");
  }

  return data.user.id;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: ALLOW_HEADERS,
    allowMethods: ALLOW_METHODS,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let options: SyncRequestOptions;
  try {
    options = await parseSyncRequestOptions(req);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Invalid request body." }, 400);
  }

  let scopeUserId: string | null = null;
  let mode: "manual" | "cron" = "manual";

  try {
    if (isCronRequest(req, CRON_SECRET)) {
      mode = "cron";
    } else {
      const jwt = getBearerToken(req);
      if (!jwt) {
        throw new HttpError(401, "Unauthorized.");
      }
      scopeUserId = await getManualUserId(jwt);
    }
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "authorize_request",
      mode,
      user_id: scopeUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Unauthorized." }, 401);
  }

  try {
    const allowForceArchivePending = mode === "cron" && options.forceArchivePendingDays !== null;
    let connectionsQuery = adminClient
      .from("bank_connections")
      .select("id, user_id, token_enc, token_kid")
      .eq("provider", "simplefin")
      .eq("status", "active");

    if (scopeUserId) {
      connectionsQuery = connectionsQuery.eq("user_id", scopeUserId);
    }

    const { data: connections, error: connectionsError } = await connectionsQuery;
    if (connectionsError) {
      throw new HttpError(500, "Could not load bank connections.");
    }

    const safeConnections = (connections ?? []) as ConnectionRow[];
    const uniqueUserIds = [...new Set(safeConnections.map((connection) => connection.user_id))];
    const daysMap = await getRawDescriptionDaysMap(adminClient, uniqueUserIds);
    const userTransactionCountCache = new Map<string, number>();
    const userCategoryRuleCache = new Map<string, CategoryRuleV1[]>();
    const userOwnerRuleCache = new Map<string, OwnerRuleV1[]>();

    let accountsSynced = 0;
    let transactionsSynced = 0;
    let categorizedByRules = 0;
    let ownerAssignedByRules = 0;
    let stalePendingArchived = 0;
    let forcePendingArchived = 0;
    const seenAccountKeys = new Set<string>();
    const seenTransactionKeys = new Set<string>();
    const warnings: string[] = [];

    for (const connection of safeConnections) {
      if (!connection.token_enc) {
        continue;
      }

      const userPreference = daysMap.get(connection.user_id) ?? {
        rawDescriptionDays: 90,
        retentionMonths: 24,
      };
      const rawDescriptionDays = userPreference.rawDescriptionDays;
      let accessUrl = "";
      try {
        accessUrl = await decryptAccessUrl(connection, SIMPLEFIN_ENC_KEY, SIMPLEFIN_KEYS_BY_KID);
      } catch (decryptError) {
        const details = errorInfo(decryptError);
        warnings.push(`Could not decrypt connection ${connection.id}: ${details.message}`);
        console.error(JSON.stringify({
          function: FUNCTION_NAME,
          action: "decrypt_access_url",
          mode,
          user_id: connection.user_id,
          connection_id: connection.id,
          message: details.message,
          stack: details.stack,
        }));
        continue;
      }

      try {
        const payloads: unknown[] = [];
        const pendingCleanupKeys = new Set<string>();
        const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
        const lookbackEndExclusive = addCalendarDays(new Date(), 1);
        const lookbackStart = addCalendarDays(lookbackEndExclusive, -lookbackDays);
        payloads.push(await fetchAccounts(accessUrl, {
          pending: true,
          startDate: toUnixSeconds(lookbackStart),
          endDate: toUnixSeconds(lookbackEndExclusive),
        }));

        if (mode === "manual") {
          const cachedCount = userTransactionCountCache.get(connection.user_id);
          const currentTransactionCount = cachedCount ??
            await getTransactionCountForUser(adminClient, connection.user_id);
          userTransactionCountCache.set(connection.user_id, currentTransactionCount);

          // Backfill in 60-day windows:
          // - automatic for new/near-empty histories
          // - optional "repair" backfill when requested via backfill_months
          const requestedBackfillMonths = options.backfillMonths;
          const shouldBackfill = currentTransactionCount < 50 || requestedBackfillMonths !== null;
          if (shouldBackfill) {
            const monthsToBackfill = Math.min(
              requestedBackfillMonths ?? userPreference.retentionMonths,
              userPreference.retentionMonths,
            );
            const windows = buildBackfillWindowsExclusive(monthsToBackfill);
            for (const window of windows) {
              try {
                payloads.push(await fetchAccounts(accessUrl, {
                  startDate: window.startDate,
                  endDate: window.endDate,
                  pending: true,
                }));
              } catch (windowError) {
                const details = errorInfo(windowError);
                warnings.push(`Backfill window fetch failed for connection ${connection.id}.`);
                console.error(JSON.stringify({
                  function: FUNCTION_NAME,
                  action: "fetch_accounts_backfill_window",
                  mode,
                  user_id: connection.user_id,
                  connection_id: connection.id,
                  start_date: window.startDate,
                  end_date: window.endDate,
                  message: details.message,
                  stack: details.stack,
                }));
              }
            }
          }
        }

        for (const payload of payloads) {
          const payloadRecord = asRecord(payload);
          const payloadErrors = payloadRecord?.errors;
          if (Array.isArray(payloadErrors)) {
            for (const err of payloadErrors) {
              const errRecord = asRecord(err);
              const message = errRecord ? pickString(errRecord, ["message", "error", "detail"]) : "";
              if (message) {
                warnings.push(message);
              }
            }
          }

          const accounts = parseAccountsPayload(payload);

          for (const accountObject of accounts) {
            const providerAccountId = pickString(accountObject, [
              "id",
              "account_id",
              "accountId",
              "provider_account_id",
            ]);

            if (!providerAccountId) {
              continue;
            }

            const institutionObject = asRecord(accountObject.org) ?? asRecord(accountObject.institution);
            const institutionName = institutionObject ? pickString(institutionObject, ["name"]) : "";
            const accountName = pickString(accountObject, ["name", "display_name"]) || "Account";
            const accountType = pickString(accountObject, ["type", "subtype"]) || "other";
            const accountCurrency = pickString(accountObject, ["currency", "currency_code"]) || "USD";
            const accountBalance = pickNumber(accountObject, ["balance", "current_balance", "currentBalance"]);
            const availableBalance = pickNumber(accountObject, ["available_balance", "availableBalance"]);
            const syncedAt = new Date().toISOString();

            const account = await upsertAccount(adminClient, {
              user_id: connection.user_id,
              provider_account_id: providerAccountId,
              name: accountName,
              institution: institutionName || null,
              type: accountType,
              currency: accountCurrency,
              balance: accountBalance,
              available_balance: availableBalance,
              last_synced_at: syncedAt,
            });

            const accountKey = `${connection.user_id}:${providerAccountId}`;
            if (!seenAccountKeys.has(accountKey)) {
              seenAccountKeys.add(accountKey);
              accountsSynced += 1;
            }

            const transactionRows: Record<string, unknown>[] = [];
            const transactionSnapshots: ImportedTransactionSnapshot[] = [];
            const transactions = parseTransactions(accountObject);

            for (const transactionObject of transactions) {
              const providerTransactionId = pickString(transactionObject, [
                "id",
                "transaction_id",
                "transactionId",
                "provider_transaction_id",
              ]);

              if (!providerTransactionId) {
                continue;
              }

              const rawAmount = pickNumber(transactionObject, ["amount", "value"]);
              if (rawAmount === null) {
                continue;
              }

              const isPending =
                transactionObject.pending === true || transactionObject.is_pending === true ||
                pickString(transactionObject, ["status"]).toLowerCase() === "pending";

              const rawDescription = pickString(transactionObject, [
                "description",
                "raw_description",
                "memo",
                "payee",
                "name",
              ]);

              const descriptionShort = truncate(rawDescription || "Transaction", 256);
              const postedAt = toIsoDate(
                transactionObject.posted_at ?? transactionObject.posted ?? transactionObject.date,
                new Date().toISOString(),
              );
              const authorizedAtRaw = transactionObject.authorized_at ?? transactionObject.authorized;
              const authorizedAt = authorizedAtRaw ? toIsoDate(authorizedAtRaw, postedAt) : null;

              const shouldStoreFull = rawDescriptionDays > 0 && rawDescription.length > 0;
              const descriptionFull = shouldStoreFull ? rawDescription : null;
              const descriptionFullExpiresAt = shouldStoreFull
                ? addDays(postedAt, rawDescriptionDays)
                : null;
              const merchantCanonical = normalizeCanonicalMerchant(rawDescription || descriptionShort);
              const merchantNormalized = normalizeMerchantForSearch(rawDescription);

              const transactionKey = `${account.id}:${providerTransactionId}`;
              if (!seenTransactionKeys.has(transactionKey)) {
                seenTransactionKeys.add(transactionKey);
                transactionsSynced += 1;
              }

              transactionRows.push({
                user_id: connection.user_id,
                account_id: account.id,
                provider_transaction_id: providerTransactionId,
                amount: rawAmount,
                currency: pickString(transactionObject, ["currency", "currency_code"]) || accountCurrency,
                posted_at: postedAt,
                authorized_at: authorizedAt,
                is_pending: isPending,
                description_short: descriptionShort,
                description_full: descriptionFull,
                description_full_expires_at: descriptionFullExpiresAt,
                merchant_normalized: merchantNormalized,
                merchant_canonical: merchantCanonical,
                is_deleted: transactionObject.is_deleted === true || transactionObject.deleted === true,
              });

              transactionSnapshots.push({
                accountId: account.id,
                providerTransactionId,
                amount: rawAmount,
                merchantCanonical,
                merchantNormalized,
                descriptionShort,
              });
            }

            await upsertTransactions(adminClient, transactionRows);

            if (transactionSnapshots.length > 0) {
              const categoryRules = await getCategoryRulesV1ForUser(
                adminClient,
                connection.user_id,
                userCategoryRuleCache,
              );
              const ownerRules = await getOwnerRulesV1ForUser(
                adminClient,
                connection.user_id,
                userOwnerRuleCache,
              );
              categorizedByRules += await applyCategoryRulesV1AfterImport(
                adminClient,
                connection.user_id,
                account.id,
                transactionSnapshots,
                categoryRules,
              );
              ownerAssignedByRules += await applyOwnerRulesV1AfterImport(
                adminClient,
                connection.user_id,
                account.id,
                transactionSnapshots,
                ownerRules,
              );
            }

            const cleanupKey = `${connection.user_id}:${account.id}`;
            if (!pendingCleanupKeys.has(cleanupKey)) {
              pendingCleanupKeys.add(cleanupKey);
              stalePendingArchived += await reconcileStalePendingTransactions(adminClient, connection.user_id, account.id);
              if (allowForceArchivePending) {
                forcePendingArchived += await forceArchivePendingTransactions(
                  adminClient,
                  connection.user_id,
                  account.id,
                  options.forceArchivePendingDays as number,
                );
              }
            }
          }
        }
      } catch (connectionSyncError) {
        const details = errorInfo(connectionSyncError);
        warnings.push(`Connection ${connection.id} sync failed.`);
        console.error(JSON.stringify({
          function: FUNCTION_NAME,
          action: "sync_connection",
          mode,
          user_id: connection.user_id,
          connection_id: connection.id,
          message: details.message,
          stack: details.stack,
        }));
      }
    }

    return json(req, {
      ok: true,
      mode,
      users: uniqueUserIds.length,
      connections: safeConnections.length,
      accountsSynced,
      transactionsSynced,
      categorizedByRules,
      ownerAssignedByRules,
      stalePendingArchived,
      forcePendingArchived,
      forceArchivePendingDays: allowForceArchivePending ? options.forceArchivePendingDays : null,
      warnings,
    });
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "sync_flow",
      mode,
      user_id: scopeUserId,
      message: details.message,
      stack: details.stack,
    }));
    if (error instanceof HttpError) {
      return json(req, { error: error.message }, error.status);
    }
    return json(req, { error: "Sync failed." }, 500);
  }
});
