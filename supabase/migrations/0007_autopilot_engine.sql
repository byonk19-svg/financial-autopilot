-- Autopilot engine core tables: subscriptions, alerts, and daily user metrics.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_normalized text not null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly', 'unknown')),
  confidence numeric not null default 0.0 check (confidence >= 0 and confidence <= 1),
  last_amount numeric null,
  prev_amount numeric null,
  last_charge_at date null,
  next_expected_at date null,
  occurrences int not null default 0,
  price_history jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_normalized, cadence)
);

create index if not exists idx_subscriptions_user_active
  on public.subscriptions (user_id, is_active);

create index if not exists idx_subscriptions_user_next_expected
  on public.subscriptions (user_id, next_expected_at);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alert_type text not null check (
    alert_type in ('unusual_charge', 'duplicate_charge', 'subscription_increase', 'pace_warning', 'bill_spike')
  ),
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  body text not null,
  fingerprint text not null,
  merchant_normalized text null,
  amount numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  is_dismissed boolean not null default false,
  unique (user_id, alert_type, fingerprint)
);

create index if not exists idx_alerts_user_created_at_desc
  on public.alerts (user_id, created_at desc);

create index if not exists idx_alerts_user_dismissed_created_at_desc
  on public.alerts (user_id, is_dismissed, created_at desc);

create table if not exists public.user_metrics_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  spend_total numeric not null default 0,
  spend_weekend numeric not null default 0,
  spend_weekday numeric not null default 0,
  spend_after_20 numeric not null default 0,
  spend_after_22 numeric not null default 0,
  small_purchases_10_30 numeric not null default 0,
  discretionary_spend numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_alerts_set_updated_at on public.alerts;
create trigger trg_alerts_set_updated_at
before update on public.alerts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_metrics_daily_set_updated_at on public.user_metrics_daily;
create trigger trg_user_metrics_daily_set_updated_at
before update on public.user_metrics_daily
for each row
execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.alerts enable row level security;
alter table public.user_metrics_daily enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  using (user_id = auth.uid());

drop policy if exists alerts_select_own on public.alerts;
create policy alerts_select_own
  on public.alerts
  for select
  using (user_id = auth.uid());

drop policy if exists alerts_update_own on public.alerts;
create policy alerts_update_own
  on public.alerts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_metrics_daily_select_own on public.user_metrics_daily;
create policy user_metrics_daily_select_own
  on public.user_metrics_daily
  for select
  using (user_id = auth.uid());

drop policy if exists user_metrics_daily_update_own on public.user_metrics_daily;
create policy user_metrics_daily_update_own
  on public.user_metrics_daily
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
