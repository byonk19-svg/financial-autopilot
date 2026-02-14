-- Schedule weekly Autopilot Feed insights.
-- Runs Mondays at 13:00 UTC (after morning daily sync window).

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'simplefin-weekly-insights';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'simplefin-weekly-insights',
  '0 13 * * 1',
  $$
  select net.http_post(
    url := (
      select value from private.scheduler_secrets where key = 'project_url'
    ) || '/functions/v1/weekly-insights',
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
