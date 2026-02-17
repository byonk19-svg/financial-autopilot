-- Daily renewal reminder generation for upcoming subscription renewals.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'subscription-renewal-alerts';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'subscription-renewal-alerts',
  '20 12 * * *',
  $$
  select net.http_post(
    url := (
      select value from private.scheduler_secrets where key = 'project_url'
    ) || '/functions/v1/subscription-renewal-alerts',
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
