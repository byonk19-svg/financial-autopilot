# Docs

## Weekly Insights

### Database migration

```powershell
supabase db push
```

This applies:

- `supabase/migrations/0005_insights.sql` for `public.insights`
- `supabase/migrations/0006_generate_weekly_insights_schedule.sql` for the weekly cron job

### Deploy function

```powershell
supabase functions deploy generate-weekly-insights
```

### Required edge secrets

```powershell
supabase secrets set CRON_SECRET="YOUR_CRON_SECRET_VALUE"
```

### Schedule

The migration schedules `generate-weekly-insights` at `0 2 * * 1` (UTC), which is:

- Sunday 8:00 PM CST (winter)
- Sunday 9:00 PM CDT (summer)

Scheduler HTTP calls read `project_url` and `cron_secret` from `private.scheduler_secrets`.

### Verify jobs

```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```
