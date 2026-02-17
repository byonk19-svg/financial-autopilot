-- Add machine-readable alert reasoning and user feedback-driven suppression.

alter table public.alerts
add column if not exists reasoning jsonb null;

create table if not exists public.alert_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  alert_type text not null check (
    alert_type in (
      'unusual_charge',
      'duplicate_charge',
      'subscription_increase',
      'pace_warning',
      'bill_spike',
      'subscription_renewal'
    )
  ),
  merchant_canonical text not null,
  is_expected boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_alert_feedback_user_type_merchant_created
on public.alert_feedback (user_id, alert_type, merchant_canonical, created_at desc);

alter table public.alert_feedback enable row level security;

drop policy if exists alert_feedback_select_own on public.alert_feedback;
create policy alert_feedback_select_own
  on public.alert_feedback
  for select
  using (user_id = auth.uid());

drop policy if exists alert_feedback_insert_own on public.alert_feedback;
create policy alert_feedback_insert_own
  on public.alert_feedback
  for insert
  with check (user_id = auth.uid());
