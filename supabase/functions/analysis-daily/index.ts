import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSupabaseConfig, requireEnv } from "../_shared/env.ts";
import { ALLOW_HEADERS, ALLOW_METHODS, FUNCTION_NAME } from "./constants.ts";
import { runAnalysis } from "./run.ts";
import { errorInfo } from "./utils.ts";

const { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseConfig();
const CRON_SECRET = requireEnv("CRON_SECRET");

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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const result = await runAnalysis(admin, req, CRON_SECRET);
    return json(req, result.body, result.status);
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "run_analysis",
      message: details.message,
      stack: details.stack,
    }));
    return json(
      req,
      {
        error: "Daily analysis failed.",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
