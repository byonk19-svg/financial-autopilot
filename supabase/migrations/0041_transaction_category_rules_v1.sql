-- Minimal v1 rules-first categorization table.
-- Supports only:
-- 1) merchant_contains
-- 2) merchant_exact
-- 3) merchant_contains_account
-- 4) merchant_contains_amount_range

create table if not exists public.transaction_category_rules_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_type text not null check (
    rule_type in (
      'merchant_contains',
      'merchant_exact',
      'merchant_contains_account',
      'merchant_contains_amount_range'
    )
  ),
  merchant_pattern text not null,
  account_id uuid null references public.accounts (id) on delete cascade,
  min_amount numeric null,
  max_amount numeric null,
  category_id uuid not null references public.categories (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (merchant_pattern <> ''),
  check (min_amount is null or min_amount >= 0),
  check (max_amount is null or max_amount >= 0),
  check (min_amount is null or max_amount is null or min_amount <= max_amount),
  check (
    (rule_type = 'merchant_contains' and account_id is null and min_amount is null and max_amount is null)
    or
    (rule_type = 'merchant_exact' and account_id is null and min_amount is null and max_amount is null)
    or
    (rule_type = 'merchant_contains_account' and account_id is not null and min_amount is null and max_amount is null)
    or
    (rule_type = 'merchant_contains_amount_range' and account_id is null and min_amount is not null and max_amount is not null)
  )
);

create unique index if not exists uq_transaction_category_rules_v1_signature
  on public.transaction_category_rules_v1 (
    user_id,
    rule_type,
    lower(merchant_pattern),
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(min_amount, -1),
    coalesce(max_amount, -1),
    category_id
  );

create index if not exists idx_transaction_category_rules_v1_user_active_type
  on public.transaction_category_rules_v1 (user_id, is_active, rule_type);

create index if not exists idx_transaction_category_rules_v1_user_merchant
  on public.transaction_category_rules_v1 (user_id, lower(merchant_pattern));

create index if not exists idx_transaction_category_rules_v1_user_account
  on public.transaction_category_rules_v1 (user_id, account_id);

drop trigger if exists trg_transaction_category_rules_v1_set_updated_at on public.transaction_category_rules_v1;
create trigger trg_transaction_category_rules_v1_set_updated_at
before update on public.transaction_category_rules_v1
for each row
execute function public.set_updated_at();

alter table public.transaction_category_rules_v1 enable row level security;

drop policy if exists transaction_category_rules_v1_select_own on public.transaction_category_rules_v1;
create policy transaction_category_rules_v1_select_own
  on public.transaction_category_rules_v1
  for select
  using (user_id = auth.uid());

drop policy if exists transaction_category_rules_v1_insert_own on public.transaction_category_rules_v1;
create policy transaction_category_rules_v1_insert_own
  on public.transaction_category_rules_v1
  for insert
  with check (user_id = auth.uid());

drop policy if exists transaction_category_rules_v1_update_own on public.transaction_category_rules_v1;
create policy transaction_category_rules_v1_update_own
  on public.transaction_category_rules_v1
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists transaction_category_rules_v1_delete_own on public.transaction_category_rules_v1;
create policy transaction_category_rules_v1_delete_own
  on public.transaction_category_rules_v1
  for delete
  using (user_id = auth.uid());
