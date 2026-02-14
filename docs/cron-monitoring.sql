-- Run in Supabase SQL Editor to verify scheduler health.

-- 1) Confirm jobs are scheduled and active.
select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname in ('daily_simplefin_sync', 'daily_redact_descriptions')
order by jobname;

-- 2) Inspect the most recent executions.
select
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  r.return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname in ('daily_simplefin_sync', 'daily_redact_descriptions')
order by r.start_time desc
limit 20;

-- 3) Quick 48h summary.
select
  j.jobname,
  count(*) filter (where r.start_time >= now() - interval '48 hours') as runs_48h,
  count(*) filter (
    where r.start_time >= now() - interval '48 hours'
      and r.status = 'succeeded'
  ) as successes_48h,
  max(r.start_time) as latest_start
from cron.job j
left join cron.job_run_details r on r.jobid = j.jobid
where j.jobname in ('daily_simplefin_sync', 'daily_redact_descriptions')
group by j.jobname
order by j.jobname;
