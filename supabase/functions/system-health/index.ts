import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required environment configuration.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TRACKED_JOBS = [
  "daily_simplefin_sync",
  "daily_redact_descriptions",
  "weekly-insights",
  "analysis-daily",
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const cronHealth = await getCronHealth(admin);

    return json({
      ok: true,
      generated_at: new Date().toISOString(),
      jobs: cronHealth.jobs,
      latest_error: cronHealth.latest_error,
    });
  } catch (error) {
    return json(
      {
        error: "Could not build system health.",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
