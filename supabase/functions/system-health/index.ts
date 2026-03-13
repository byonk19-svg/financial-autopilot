import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSupabaseConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseConfig();

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOW_METHODS = "GET, OPTIONS";
const FUNCTION_NAME = "system-health";

const TRACKED_JOBS = [
  "daily_simplefin_sync",
  "daily_redact_descriptions",
  "weekly-insights",
  "analysis-daily",
  "subscription-renewal-alerts",
];

type CronJobRow = {
  job_name: string;
  schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

type HealthJob = {
  job_name: string;
  schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
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

function isSuccessfulStatus(status: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase().includes("succeeded");
}

function truncate(value: string | null, max = 220): string | null {
  if (!value) return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
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

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function resolveAuthorizedUserId(
  admin: ReturnType<typeof createClient>,
  req: Request,
): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

async function getCronHealth(admin: ReturnType<typeof createClient>): Promise<{
  jobs: HealthJob[];
  latest_error: string | null;
}> {
  const { data: rawJobs, error: jobError } = await admin.rpc("get_cron_jobs_health", {
    tracked_jobs: TRACKED_JOBS,
  });

  if (jobError || !rawJobs) {
    return {
      jobs: TRACKED_JOBS.map((jobName) => ({
        job_name: jobName,
        schedule: null,
        last_run_at: null,
        last_status: "unavailable",
        last_error: "Could not read cron job metadata.",
      })),
      latest_error: "Could not read cron job metadata.",
    };
  }

  const jobs = rawJobs as CronJobRow[];
  if (jobs.length === 0) {
    return {
      jobs: TRACKED_JOBS.map((jobName) => ({
        job_name: jobName,
        schedule: null,
        last_run_at: null,
        last_status: "missing",
        last_error: "Job is not scheduled.",
      })),
      latest_error: "One or more jobs are not scheduled.",
    };
  }

  let latestErrorMessage: string | null = null;
  let latestErrorTime = "";
  const healthByName = new Map<string, HealthJob>();

  for (const job of jobs) {
    const status = job.last_status ?? null;
    const errorMessage = job.last_error
      ? truncate(job.last_error)
      : status && !isSuccessfulStatus(status)
      ? truncate(status ?? "Job did not succeed.")
      : null;

    if (errorMessage && job.last_run_at && job.last_run_at > latestErrorTime) {
      latestErrorTime = job.last_run_at;
      latestErrorMessage = `${job.job_name}: ${errorMessage}`;
    }

    healthByName.set(job.job_name, {
      job_name: job.job_name,
      schedule: job.schedule,
      last_run_at: job.last_run_at,
      last_status: status,
      last_error: errorMessage,
    });
  }

  const orderedJobs: HealthJob[] = TRACKED_JOBS.map((jobName) => {
    return (
      healthByName.get(jobName) ?? {
        job_name: jobName,
        schedule: null,
        last_run_at: null,
        last_status: "missing",
        last_error: "Job is not scheduled.",
      }
    );
  });

  return {
    jobs: orderedJobs,
    latest_error: latestErrorMessage,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: ALLOW_HEADERS,
    allowMethods: ALLOW_METHODS,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const userId = await resolveAuthorizedUserId(admin, req);
    if (!userId) {
      return json(req, { error: "Unauthorized." }, 401);
    }

    const cronHealth = await getCronHealth(admin);

    return json(req, {
      ok: true,
      generated_at: new Date().toISOString(),
      jobs: cronHealth.jobs,
      latest_error: cronHealth.latest_error,
    });
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "build_system_health",
      method: req.method,
      message: details.message,
      stack: details.stack,
    }));
    return json(
      req,
      {
        error: "Could not build system health.",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
