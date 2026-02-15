-- Activity log for manual recurring classification decisions.

create table if not exists public.recurring_classification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid null references public.subscriptions (id) on delete set null,
  old_classification text not null check (
    old_classification in ('needs_review', 'subscription', 'bill_loan', 'transfer', 'ignore')
  ),
  new_classification text not null check (
    new_classification in ('needs_review', 'subscription', 'bill_loan', 'transfer', 'ignore')
  ),
  old_user_locked boolean not null,
  new_user_locked boolean not null,
  create_rule boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_recurring_classification_events_user_created_at
  on public.recurring_classification_events (user_id, created_at desc);

create index if not exists idx_recurring_classification_events_subscription
  on public.recurring_classification_events (subscription_id, created_at desc);

alter table public.recurring_classification_events enable row level security;

drop policy if exists recurring_classification_events_select_own on public.recurring_classification_events;
create policy recurring_classification_events_select_own
  on public.recurring_classification_events
  for select
  using (user_id = auth.uid());
