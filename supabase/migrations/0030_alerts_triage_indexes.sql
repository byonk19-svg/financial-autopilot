-- Improve alerts triage filters and bulk-update performance.

create index if not exists idx_alerts_user_read_at
on public.alerts (user_id, read_at);

create index if not exists idx_alerts_user_is_dismissed
on public.alerts (user_id, is_dismissed);

create index if not exists idx_alerts_user_severity
on public.alerts (user_id, severity);
