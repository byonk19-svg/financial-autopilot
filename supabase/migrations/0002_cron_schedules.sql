-- Daily cron schedules for sync + redaction via pg_cron and pg_net.
-- Schedules are UTC:
--   simplefin-sync: 12:00 UTC daily
--   redact-descriptions: 03:15 UTC daily
--
-- Vault extension is unavailable in this project, so scheduler secrets are
-- stored in a private schema that is not exposed by PostgREST.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.scheduler_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_scheduler_secrets_set_updated_at on private.scheduler_secrets;
create trigger trg_scheduler_secrets_set_updated_at
before update on private.scheduler_secrets
for each row
execute function private.set_updated_at();

revoke all on schema private from public;
revoke all on all tables in schema private from public;
revoke all on all functions in schema private from public;

insert into private.scheduler_secrets (key, value)
values
  ('project_url', 'https://jefnjglsfxwalkslctns.supabase.co'),
  ('cron_secret', '8f9be77e54a84a1ca3a7f29d22f3c1375cb70d1b654a4dc291dcf01d991e3d57')
on conflict (key) do update
set value = excluded.value,
    updated_at = timezone('utc', now());

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'daily_simplefin_sync';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  select jobid into v_job_id from cron.job where jobname = 'daily_redact_descriptions';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'daily_simplefin_sync',
  '0 12 * * *',
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

select cron.schedule(
  'daily_redact_descriptions',
  '15 3 * * *',
  $$
  select net.http_post(
    url := (
      select value from private.scheduler_secrets where key = 'project_url'
    ) || '/functions/v1/redact-descriptions',
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
