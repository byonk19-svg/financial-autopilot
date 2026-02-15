import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET) {
  throw new Error("Missing required environment configuration.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function isCronRequest(req: Request): boolean {
  const provided = req.headers.get("x-cron-secret");
  return Boolean(provided && provided === CRON_SECRET);
}

function cutoffIsoFromMonths(months: number): string {
  const safeMonths = Number.isFinite(months) && months > 0 ? Math.floor(months) : 24;
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - safeMonths);
  return cutoff.toISOString();
}

async function resolveUserIds(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const [transactionsRes, alertsRes, insightsRes, preferencesRes] = await Promise.all([
    admin.from("transactions").select("user_id"),
    admin.from("alerts").select("user_id"),
    admin.from("insights").select("user_id"),
    admin.from("user_preferences").select("user_id"),
  ]);

  if (transactionsRes.error || alertsRes.error || insightsRes.error || preferencesRes.error) {
    throw new Error("Could not resolve retention scope users.");
  }

  const userIds = new Set<string>();
  for (const row of transactionsRes.data ?? []) userIds.add(row.user_id);
  for (const row of alertsRes.data ?? []) userIds.add(row.user_id);
  for (const row of insightsRes.data ?? []) userIds.add(row.user_id);
  for (const row of preferencesRes.data ?? []) userIds.add(row.user_id);
  return [...userIds];
}

async function retentionMonthsMap(admin: ReturnType<typeof createClient>): Promise<Map<string, number>> {
  const { data, error } = await admin.from("user_preferences").select("user_id, retention_months");
  if (error) {
    throw new Error("Could not read retention preferences.");
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const retentionMonths = typeof row.retention_months === "number" && row.retention_months > 0
      ? Math.floor(row.retention_months)
      : 24;
    map.set(row.user_id, retentionMonths);
  }
  return map;
}

async function countRowsToDelete(
  admin: ReturnType<typeof createClient>,
  table: "transactions" | "alerts" | "insights",
  userId: string,
  cutoff: string,
): Promise<number> {
  const dateColumn = table === "transactions" ? "posted_at" : "created_at";
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .lt(dateColumn, cutoff);

  if (error) {
    throw new Error(`Could not count ${table} for retention.`);
  }

  return count ?? 0;
}

async function deleteRows(
  admin: ReturnType<typeof createClient>,
  table: "transactions" | "alerts" | "insights",
  userId: string,
  cutoff: string,
): Promise<void> {
  const dateColumn = table === "transactions" ? "posted_at" : "created_at";
  const { error } = await admin
    .from(table)
    .delete()
    .eq("user_id", userId)
    .lt(dateColumn, cutoff);

  if (error) {
    throw new Error(`Could not delete ${table} for retention.`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!isCronRequest(req)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const [userIds, retentionMap] = await Promise.all([resolveUserIds(admin), retentionMonthsMap(admin)]);

    let usersProcessed = 0;
    let transactionsDeleted = 0;
    let alertsDeleted = 0;
    let insightsDeleted = 0;

    for (const userId of userIds) {
      const retentionMonths = retentionMap.get(userId) ?? 24;
      const cutoffIso = cutoffIsoFromMonths(retentionMonths);

      const [txCount, alertsCount, insightsCount] = await Promise.all([
        countRowsToDelete(admin, "transactions", userId, cutoffIso),
        countRowsToDelete(admin, "alerts", userId, cutoffIso),
        countRowsToDelete(admin, "insights", userId, cutoffIso),
      ]);

      if (txCount > 0) await deleteRows(admin, "transactions", userId, cutoffIso);
      if (alertsCount > 0) await deleteRows(admin, "alerts", userId, cutoffIso);
      if (insightsCount > 0) await deleteRows(admin, "insights", userId, cutoffIso);

      transactionsDeleted += txCount;
      alertsDeleted += alertsCount;
      insightsDeleted += insightsCount;
      usersProcessed += 1;
    }

    return json({
      ok: true,
      users_processed: usersProcessed,
      transactions_deleted: transactionsDeleted,
      alerts_deleted: alertsDeleted,
      insights_deleted: insightsDeleted,
    });
  } catch {
    return json({ error: "Purge failed." }, 500);
  }
});
