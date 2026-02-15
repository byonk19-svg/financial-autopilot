-- Rules engine foundations for deterministic pre-classification.
-- Extends merchant aliases, adds transaction rules, and stores rule provenance.

alter table public.merchant_aliases
add column if not exists user_id uuid null references auth.users (id) on delete cascade,
add column if not exists account_id uuid null references public.accounts (id) on delete cascade,
add column if not exists match_type text not null default 'contains' check (match_type in ('contains', 'equals', 'regex')),
add column if not exists priority integer not null default 100,
add column if not exists is_active boolean not null default true,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop index if exists uq_merchant_aliases_pattern;

create unique index if not exists uq_merchant_aliases_scope_pattern
  on public.merchant_aliases (
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    pattern
  );

create index if not exists idx_merchant_aliases_user_active_priority
  on public.merchant_aliases (user_id, is_active, priority);

create index if not exists idx_merchant_aliases_account
  on public.merchant_aliases (account_id);

drop trigger if exists trg_merchant_aliases_set_updated_at on public.merchant_aliases;
create trigger trg_merchant_aliases_set_updated_at
before update on public.merchant_aliases
for each row
execute function public.set_updated_at();

drop policy if exists merchant_aliases_select_visible on public.merchant_aliases;
create policy merchant_aliases_select_visible
  on public.merchant_aliases
  for select
  using (user_id is null or user_id = auth.uid());

drop policy if exists merchant_aliases_insert_own on public.merchant_aliases;
create policy merchant_aliases_insert_own
  on public.merchant_aliases
  for insert
  with check (user_id = auth.uid());

drop policy if exists merchant_aliases_update_own on public.merchant_aliases;
create policy merchant_aliases_update_own
  on public.merchant_aliases
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists merchant_aliases_delete_own on public.merchant_aliases;
create policy merchant_aliases_delete_own
  on public.merchant_aliases
  for delete
  using (user_id = auth.uid());

create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Rule',
  match_type text not null default 'contains' check (match_type in ('contains', 'equals', 'regex')),
  pattern text not null,
  account_id uuid null references public.accounts (id) on delete cascade,
  cadence text null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly', 'unknown')),
  min_amount numeric null,
  max_amount numeric null,
  target_amount numeric null,
  amount_tolerance_pct numeric null check (amount_tolerance_pct >= 0 and amount_tolerance_pct <= 1),
  set_merchant_normalized text null,
  set_pattern_classification text null check (
    set_pattern_classification in ('needs_review', 'subscription', 'bill_loan', 'transfer', 'ignore')
  ),
  set_spending_category_id uuid null references public.categories (id) on delete set null,
  explanation text null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (min_amount is null or min_amount >= 0),
  check (max_amount is null or max_amount >= 0),
  check (min_amount is null or max_amount is null or min_amount <= max_amount),
  check (amount_tolerance_pct is null or target_amount is not null)
);

create index if not exists idx_transaction_rules_user_active_priority
  on public.transaction_rules (user_id, is_active, priority);

create index if not exists idx_transaction_rules_user_pattern
  on public.transaction_rules (user_id, pattern);

create index if not exists idx_transaction_rules_account
  on public.transaction_rules (account_id);

drop trigger if exists trg_transaction_rules_set_updated_at on public.transaction_rules;
create trigger trg_transaction_rules_set_updated_at
before update on public.transaction_rules
for each row
execute function public.set_updated_at();

alter table public.transaction_rules enable row level security;

drop policy if exists transaction_rules_select_own on public.transaction_rules;
create policy transaction_rules_select_own
  on public.transaction_rules
  for select
  using (user_id = auth.uid());

drop policy if exists transaction_rules_insert_own on public.transaction_rules;
create policy transaction_rules_insert_own
  on public.transaction_rules
  for insert
  with check (user_id = auth.uid());

drop policy if exists transaction_rules_update_own on public.transaction_rules;
create policy transaction_rules_update_own
  on public.transaction_rules
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists transaction_rules_delete_own on public.transaction_rules;
create policy transaction_rules_delete_own
  on public.transaction_rules
  for delete
  using (user_id = auth.uid());

alter table public.transactions
add column if not exists classification_rule_ref text null,
add column if not exists classification_explanation text null;

create index if not exists idx_transactions_user_classification_rule_ref
  on public.transactions (user_id, classification_rule_ref);

alter table public.subscriptions
add column if not exists classification_rule_ref text null,
add column if not exists classification_explanation text null;

create index if not exists idx_subscriptions_user_classification_rule_ref
  on public.subscriptions (user_id, classification_rule_ref);
