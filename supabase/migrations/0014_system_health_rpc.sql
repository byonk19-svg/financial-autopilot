-- Expose cron health safely to edge functions via public RPC.

create or replace function public.get_cron_jobs_health(tracked_jobs text[])
returns table (
  job_name text,
  schedule text,
  last_run_at timestamptz,
  last_status text,
  last_error text
)
language sql
security definer
set search_path = public, cron, pg_catalog
as $$
  with requested as (
    select
      job_name,
      ordinality
    from unnest(coalesce(tracked_jobs, '{}'::text[])) with ordinality as t(job_name, ordinality)
  ),
  matched_jobs as (
    select
      r.job_name as requested_name,
      r.ordinality,
      j.jobid,
      j.jobname,
      j.schedule::text as schedule
    from requested r
    left join cron.job j
      on j.jobname = r.job_name
  )
  select
    m.requested_name as job_name,
    m.schedule,
    run.start_time as last_run_at,
    run.status::text as last_status,
    case
      when m.jobid is null then 'Job is not scheduled.'
      when run.status is null then null
      when lower(run.status) like '%succeeded%' then null
      else left(coalesce(run.return_message, run.status), 220)
    end as last_error
  from matched_jobs m
  left join lateral (
    select
      d.start_time,
      d.status,
      d.return_message
    from cron.job_run_details d
    where d.jobid = m.jobid
    order by d.start_time desc nulls last
    limit 1
  ) run on true
  order by m.ordinality;
$$;

revoke all on function public.get_cron_jobs_health(text[]) from public;
grant execute on function public.get_cron_jobs_health(text[]) to service_role;
