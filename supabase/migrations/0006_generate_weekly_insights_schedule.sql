-- Replace legacy weekly insights schedule with generate-weekly-insights.
-- Runs at 02:00 UTC every Monday (Sunday 8:00pm CST in winter, 9:00pm CDT in summer).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'simplefin-weekly-insights';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  select jobid into v_job_id from cron.job where jobname = 'weekly-insights';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'weekly-insights',
  '0 2 * * 1',
  $$
  select net.http_post(
    url := (
      select value from private.scheduler_secrets where key = 'project_url'
    ) || '/functions/v1/generate-weekly-insights',
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
