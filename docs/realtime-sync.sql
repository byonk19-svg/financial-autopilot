-- Near-real-time SimpleFIN sync schedule (every 30 minutes).
-- Run in Supabase SQL Editor.
--
-- Notes:
-- - Keeps the existing job name `daily_simplefin_sync` so system-health checks continue working.
-- - Uses existing values in private.scheduler_secrets (project_url + cron_secret).
-- - Adjust cron expression if you want a different cadence (for example */15 for every 15 minutes).

-- 1) Inspect existing sync job.
select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'daily_simplefin_sync';

-- 2) Replace daily schedule with every-30-minutes schedule.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'daily_simplefin_sync';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'daily_simplefin_sync',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (
      select value from private.scheduler_secrets where key = 'project_url'
    ) || '/functions/v1/simplefin-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select value from private.scheduler_secrets where key = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 3) Verify schedule + recent runs.
select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'daily_simplefin_sync';

select
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  left(coalesce(r.return_message, ''), 300) as return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'daily_simplefin_sync'
order by r.start_time desc
limit 20;
