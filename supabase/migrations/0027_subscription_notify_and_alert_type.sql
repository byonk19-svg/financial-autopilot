-- Add renewal notification settings for recurring subscriptions and extend alerts for renewal reminders.

alter table public.subscriptions
add column if not exists notify_days_before integer null;

alter table public.subscriptions
drop constraint if exists subscriptions_notify_days_before_check;

alter table public.subscriptions
add constraint subscriptions_notify_days_before_check
check (notify_days_before is null or notify_days_before between 1 and 60);

create index if not exists idx_subscriptions_user_next_expected_notify
on public.subscriptions (user_id, next_expected_at, notify_days_before)
where is_active = true;

alter table public.alerts
drop constraint if exists alerts_alert_type_check;

alter table public.alerts
add constraint alerts_alert_type_check
check (
  alert_type in (
    'unusual_charge',
    'duplicate_charge',
    'subscription_increase',
    'pace_warning',
    'bill_spike',
    'subscription_renewal'
  )
);
