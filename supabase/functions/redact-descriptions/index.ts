import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment configuration.");
}

if (!CRON_SECRET) {
  throw new Error("Missing CRON_SECRET.");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const providedSecret = req.headers.get("x-cron-secret");
  if (!providedSecret || providedSecret !== CRON_SECRET) {
    return json({ error: "Unauthorized." }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await adminClient.rpc("purge_expired_transaction_descriptions");
  if (error) {
    return json({ error: "Failed to redact descriptions." }, 500);
  }

  return json({ ok: true, redactedCount: data ?? 0 });
});
