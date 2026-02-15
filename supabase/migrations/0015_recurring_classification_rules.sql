-- User-defined rules for auto-classifying recurring patterns.

create table if not exists public.recurring_classification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_normalized text not null,
  cadence text null check (cadence is null or cadence in ('weekly', 'monthly', 'quarterly', 'yearly', 'unknown')),
  min_amount numeric null,
  max_amount numeric null,
  classification text not null default 'needs_review' check (
    classification in ('needs_review', 'subscription', 'bill_loan', 'transfer', 'ignore')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_recurring_classification_rules_match
  on public.recurring_classification_rules (
    user_id,
    merchant_normalized,
    coalesce(cadence, ''),
    coalesce(min_amount, -1),
    coalesce(max_amount, -1),
    classification
  );

create index if not exists idx_recurring_classification_rules_user_classification
  on public.recurring_classification_rules (user_id, classification);

create index if not exists idx_recurring_classification_rules_user_active
  on public.recurring_classification_rules (user_id, is_active);

drop trigger if exists trg_recurring_classification_rules_set_updated_at on public.recurring_classification_rules;
create trigger trg_recurring_classification_rules_set_updated_at
before update on public.recurring_classification_rules
for each row
execute function public.set_updated_at();

alter table public.recurring_classification_rules enable row level security;

drop policy if exists recurring_classification_rules_select_own on public.recurring_classification_rules;
create policy recurring_classification_rules_select_own
  on public.recurring_classification_rules
  for select
  using (user_id = auth.uid());

drop policy if exists recurring_classification_rules_insert_own on public.recurring_classification_rules;
create policy recurring_classification_rules_insert_own
  on public.recurring_classification_rules
  for insert
  with check (user_id = auth.uid());

drop policy if exists recurring_classification_rules_update_own on public.recurring_classification_rules;
create policy recurring_classification_rules_update_own
  on public.recurring_classification_rules
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists recurring_classification_rules_delete_own on public.recurring_classification_rules;
create policy recurring_classification_rules_delete_own
  on public.recurring_classification_rules
  for delete
  using (user_id = auth.uid());
