import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSupabaseConfig, requireEnv } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/hash.ts";

const { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseConfig();
const CRON_SECRET = requireEnv("CRON_SECRET");

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-cron-secret";
const ALLOW_METHODS = "POST, OPTIONS";
const FUNCTION_NAME = "subscription-renewal-alerts";

const SUPPORTED_CLASSIFICATIONS = ["subscription", "bill_loan"] as const;

type SubscriptionRow = {
  id: string;
  user_id: string;
  merchant_normalized: string;
  cadence: "weekly" | "monthly" | "quarterly" | "yearly" | "unknown";
  classification: "needs_review" | "subscription" | "bill_loan" | "transfer" | "ignore";
  last_amount: number | string | null;
  next_expected_at: string | null;
  notify_days_before: number | null;
};

type AlertInsert = {
  user_id: string;
  alert_type: "subscription_renewal";
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  fingerprint: string;
  merchant_normalized: string | null;
  amount: number | null;
  metadata: Record<string, unknown>;
  reasoning: Record<string, unknown> | null;
};

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req, {
        allowHeaders: ALLOW_HEADERS,
        allowMethods: ALLOW_METHODS,
      }),
      "Content-Type": "application/json",
    },
  });
}

function isCronRequest(req: Request): boolean {
  const provided = req.headers.get("x-cron-secret");
  return Boolean(provided && provided === CRON_SECRET);
}

function errorInfo(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "unknown_error",
    stack: null,
  };
}

function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const parsed = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function daysUntil(dateValue: string | null): number | null {
  const due = toDateOnly(dateValue);
  if (!due) return null;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const deltaMs = due.getTime() - today.getTime();
  return Math.round(deltaMs / (24 * 60 * 60 * 1000));
}

function defaultNotifyDays(cadence: SubscriptionRow["cadence"]): number {
  return cadence === "yearly" ? 7 : 3;
}

function effectiveNotifyDays(subscription: SubscriptionRow): number {
  const provided = subscription.notify_days_before;
  if (typeof provided === "number" && Number.isFinite(provided) && provided > 0) {
    return Math.max(1, Math.min(60, Math.round(provided)));
  }
  return defaultNotifyDays(subscription.cadence);
}

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(dateValue: string | null): string {
  const parsed = toDateOnly(dateValue);
  if (!parsed) return "unknown date";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function feedbackMerchantKey(merchant: string | null): string {
  const normalized = (merchant ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "__unscoped__";
}

async function listSubscriptions(admin: ReturnType<typeof createClient>): Promise<SubscriptionRow[]> {
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id, user_id, merchant_normalized, cadence, classification, last_amount, next_expected_at, notify_days_before",
    )
    .eq("is_active", true)
    .not("next_expected_at", "is", null)
    .in("classification", [...SUPPORTED_CLASSIFICATIONS])
    .order("next_expected_at", { ascending: true });

  if (error) {
    throw new Error("Could not load subscriptions for renewal alerts.");
  }

  return (data ?? []) as SubscriptionRow[];
}

async function filterExistingAlerts(
  admin: ReturnType<typeof createClient>,
  alerts: AlertInsert[],
): Promise<AlertInsert[]> {
  if (alerts.length === 0) return [];

  const existingKeys = new Set<string>();
  const chunkSize = 250;

  for (let index = 0; index < alerts.length; index += chunkSize) {
    const chunk = alerts.slice(index, index + chunkSize);
    const fingerprints = chunk.map((alert) => alert.fingerprint);
    const userIds = [...new Set(chunk.map((alert) => alert.user_id))];

    const { data, error } = await admin
      .from("alerts")
      .select("user_id, alert_type, fingerprint")
      .eq("alert_type", "subscription_renewal")
      .in("fingerprint", fingerprints)
      .in("user_id", userIds);

    if (error) {
      throw new Error("Could not check existing renewal alerts.");
    }

    for (const row of data ?? []) {
      existingKeys.add(`${row.user_id}|${row.alert_type}|${row.fingerprint}`);
    }
  }

  return alerts.filter((alert) => {
    const key = `${alert.user_id}|${alert.alert_type}|${alert.fingerprint}`;
    return !existingKeys.has(key);
  });
}

async function filterAlertsByFeedback(
  admin: ReturnType<typeof createClient>,
  alerts: AlertInsert[],
): Promise<{ alerts: AlertInsert[]; suppressedByFeedback: number }> {
  if (alerts.length === 0) return { alerts: [], suppressedByFeedback: 0 };

  const userIds = [...new Set(alerts.map((alert) => alert.user_id))];
  const merchantKeys = [...new Set(alerts.map((alert) => feedbackMerchantKey(alert.merchant_normalized)))];

  const { data, error } = await admin
    .from("alert_feedback")
    .select("user_id, alert_type, merchant_canonical")
    .eq("alert_type", "subscription_renewal")
    .in("user_id", userIds)
    .in("merchant_canonical", merchantKeys);

  if (error) {
    throw new Error("Could not load renewal alert feedback.");
  }

  const suppressionKeys = new Set<string>();
  for (const row of data ?? []) {
    const merchantKey = feedbackMerchantKey(typeof row.merchant_canonical === "string" ? row.merchant_canonical : null);
    suppressionKeys.add(`${row.user_id}:${row.alert_type}:${merchantKey}`);
  }

  const filtered = alerts.filter((alert) => {
    const merchantKey = feedbackMerchantKey(alert.merchant_normalized);
    return !suppressionKeys.has(`${alert.user_id}:${alert.alert_type}:${merchantKey}`);
  });

  return {
    alerts: filtered,
    suppressedByFeedback: alerts.length - filtered.length,
  };
}

async function insertAlerts(admin: ReturnType<typeof createClient>, alerts: AlertInsert[]): Promise<number> {
  if (alerts.length === 0) return 0;

  const batchSize = 500;
  let inserted = 0;

  for (let index = 0; index < alerts.length; index += batchSize) {
    const batch = alerts.slice(index, index + batchSize);
    const { error } = await admin
      .from("alerts")
      .upsert(batch, {
        onConflict: "user_id,alert_type,fingerprint",
        ignoreDuplicates: true,
      });

    if (error) {
      throw new Error("Could not insert renewal alerts.");
    }

    inserted += batch.length;
  }

  return inserted;
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

  if (!isCronRequest(req)) {
    return json(req, { error: "Unauthorized." }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const subscriptions = await listSubscriptions(admin);

    const candidateAlerts: AlertInsert[] = [];
    for (const subscription of subscriptions) {
      const daysRemaining = daysUntil(subscription.next_expected_at);
      if (daysRemaining === null || daysRemaining < 0) continue;

      const notifyDays = effectiveNotifyDays(subscription);
      if (daysRemaining > notifyDays) continue;

      const amount = Math.abs(toNumber(subscription.last_amount));
      const fingerprint = await sha256Hex(
        `${subscription.user_id}|subscription_renewal|${subscription.id}|${subscription.next_expected_at}`,
      );

      const urgency = daysRemaining <= 1 ? "Renews very soon" : "Upcoming renewal";
      const amountText = amount > 0 ? ` for ${formatUsd(amount)}` : "";
      const dueText = formatDate(subscription.next_expected_at);
      const cadenceText = subscription.cadence === "unknown" ? "recurring" : subscription.cadence;

      candidateAlerts.push({
        user_id: subscription.user_id,
        alert_type: "subscription_renewal",
        severity: daysRemaining <= 1 ? "medium" : "low",
        title: `${urgency}: ${subscription.merchant_normalized}`,
        body:
          `${subscription.merchant_normalized} ${cadenceText} charge is expected on ${dueText}${amountText}. ` +
          `Reminder window: ${notifyDays} day${notifyDays === 1 ? "" : "s"}.`,
        fingerprint,
        merchant_normalized: subscription.merchant_normalized,
        amount: amount > 0 ? amount : null,
        metadata: {
          subscription_id: subscription.id,
          cadence: subscription.cadence,
          next_expected_at: subscription.next_expected_at,
          days_until: daysRemaining,
          notify_days_before: notifyDays,
          classification: subscription.classification,
        },
        reasoning: {
          trigger: "upcoming_renewal_window",
          subscription_id: subscription.id,
          cadence: subscription.cadence,
          classification: subscription.classification,
          next_expected_at: subscription.next_expected_at,
          days_until: daysRemaining,
          notify_days_before: notifyDays,
          amount: amount > 0 ? amount : null,
        },
      });
    }

    const pendingAlerts = await filterExistingAlerts(admin, candidateAlerts);
    const feedbackFiltered = await filterAlertsByFeedback(admin, pendingAlerts);
    const insertedCount = await insertAlerts(admin, feedbackFiltered.alerts);

    return json(req, {
      ok: true,
      subscriptions_scanned: subscriptions.length,
      alerts_candidates: candidateAlerts.length,
      alerts_suppressed_by_feedback: feedbackFiltered.suppressedByFeedback,
      alerts_inserted: insertedCount,
    });
  } catch (error) {
    const details = errorInfo(error);
    console.error(
      JSON.stringify({
        function: FUNCTION_NAME,
        action: "generate_renewal_alerts",
        message: details.message,
        stack: details.stack,
      }),
    );
    return json(req, { error: "Could not generate renewal alerts." }, 500);
  }
});
