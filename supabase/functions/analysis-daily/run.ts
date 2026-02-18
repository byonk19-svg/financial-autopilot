import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { resolveManualUserId, isCronAuthorized } from "./auth.ts";
import { FUNCTION_NAME, LOOKBACK_90_DAYS, LOOKBACK_180_DAYS, LOOKBACK_730_DAYS } from "./constants.ts";
import { fetchCategoryNames, fetchTransactions, listUserIdsWithAccounts } from "./data.ts";
import { buildMetricsRows } from "./metrics.ts";
import {
  applyRulesToTransactions,
  fetchMerchantAliasMatchers,
  fetchTransactionRules,
  persistTransactionRuleMatches,
} from "./rules.ts";
import { buildSubscriptionCandidates, filterFalsePositiveCandidates, upsertSubscriptions } from "./subscriptions.ts";
import {
  buildDuplicateAlerts,
  buildPaceAlerts,
  buildSubscriptionIncreaseAlerts,
  buildUnusualAlerts,
  filterAlertsByFeedback,
  filterExistingAlerts,
} from "./alerts.ts";
import { dateDaysAgo, errorInfo } from "./utils.ts";

export async function runAnalysis(
  admin: ReturnType<typeof createClient>,
  req: Request,
  cronSecret: string,
): Promise<
  | { status: 401; body: { error: string } }
  | {
    status: 200;
    body: {
      ok: true;
      request_id: string;
      mode: "manual" | "cron";
      timezone_basis: "UTC";
      users_processed: number;
      subscriptions_upserted: number;
      alerts_inserted: number;
      metrics_days_upserted: number;
    };
  }
> {
  const requestId = crypto.randomUUID();
  const cronMode = isCronAuthorized(req, cronSecret);
  const manualUserId = cronMode ? null : await resolveManualUserId(admin, req);
  if (!cronMode && !manualUserId) {
    return { status: 401, body: { error: "Unauthorized." } };
  }

  const users = manualUserId ? [manualUserId] : await listUserIdsWithAccounts(admin);
  const mode = manualUserId ? "manual" : "cron";
  let usersProcessed = 0;
  let subscriptionsUpserted = 0;
  let alertsInserted = 0;
  let metricsDaysUpserted = 0;
  const start90 = dateDaysAgo(LOOKBACK_90_DAYS);
  const start180 = dateDaysAgo(LOOKBACK_180_DAYS);
  const start730 = dateDaysAgo(LOOKBACK_730_DAYS);

  for (const userId of users) {
    try {
      const aliasMatchers = await fetchMerchantAliasMatchers(admin, userId);
      const transactionRules = await fetchTransactionRules(admin, userId);
      const tx730Raw = await fetchTransactions(admin, userId, start730);
      const tx730 = applyRulesToTransactions(tx730Raw, aliasMatchers, transactionRules);
      await persistTransactionRuleMatches(admin, userId, tx730);

      const tx180 = tx730.filter((tx) => new Date(tx.posted_at) >= start180);
      const tx90 = tx180.filter((tx) => new Date(tx.posted_at) >= start90);
      const categoryNames = await fetchCategoryNames(admin, userId, tx90);

      const metricsRows = buildMetricsRows(userId, tx90, categoryNames);
      if (metricsRows.length > 0) {
        const { error: metricsError } = await admin
          .from("user_metrics_daily")
          .upsert(metricsRows, { onConflict: "user_id,day" });
        if (metricsError) throw new Error("Could not upsert daily metrics.");
        metricsDaysUpserted += metricsRows.length;
      }

      const rawSubscriptions = buildSubscriptionCandidates(userId, tx180, tx730);
      const subscriptions = await filterFalsePositiveCandidates(admin, userId, rawSubscriptions);
      subscriptionsUpserted += await upsertSubscriptions(admin, userId, subscriptions);

      const unusualAlerts = await buildUnusualAlerts(userId, tx90, tx180);
      const duplicateAlerts = await buildDuplicateAlerts(userId, tx90);
      const subscriptionAlerts = await buildSubscriptionIncreaseAlerts(userId, subscriptions);
      const paceAlerts = await buildPaceAlerts(userId, tx90, categoryNames);

      const pendingAlerts = await filterExistingAlerts(admin, userId, [
        ...unusualAlerts,
        ...duplicateAlerts,
        ...subscriptionAlerts,
        ...paceAlerts,
      ]);
      const feedbackFiltered = await filterAlertsByFeedback(admin, userId, pendingAlerts);

      if (feedbackFiltered.alerts.length > 0) {
        const { error: alertInsertError } = await admin
          .from("alerts")
          .upsert(feedbackFiltered.alerts, {
            onConflict: "user_id,alert_type,fingerprint",
            ignoreDuplicates: true,
          });
        if (alertInsertError) throw new Error("Could not insert alerts.");
        alertsInserted += feedbackFiltered.alerts.length;
      }

      usersProcessed += 1;
      console.log(
        JSON.stringify({
          user_id: userId,
          tx90_count: tx90.length,
          subscriptions_upserted: subscriptions.length,
          alerts_attempted: feedbackFiltered.alerts.length,
          alerts_suppressed_by_feedback: feedbackFiltered.suppressedByFeedback,
          metrics_days: metricsRows.length,
        }),
      );
    } catch (error) {
      const details = errorInfo(error);
      console.error(JSON.stringify({
        function: FUNCTION_NAME,
        action: "analyze_user",
        request_id: requestId,
        user_id: userId,
        message: details.message,
        stack: details.stack,
      }));
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      request_id: requestId,
      mode,
      timezone_basis: "UTC",
      users_processed: usersProcessed,
      subscriptions_upserted: subscriptionsUpserted,
      alerts_inserted: alertsInserted,
      metrics_days_upserted: metricsDaysUpserted,
    },
  };
}
