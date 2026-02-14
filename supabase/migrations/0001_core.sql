-- Core schema for Financial Autopilot
-- Includes idempotent sync constraints, raw description retention, and RLS policies.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  raw_description_days integer not null default 90 check (raw_description_days > 0),
  retention_months integer not null default 24 check (retention_months > 0)
);

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'simplefin',
  status text not null default 'active',
  access_url_ciphertext text null,
  access_url_iv text null,
  enc_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_account_id text not null,
  name text not null,
  institution text,
  type text not null,
  currency text not null default 'USD',
  balance numeric,
  available_balance numeric,
  last_synced_at timestamptz,
  unique (user_id, provider_account_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_type text not null check (match_type in ('contains', 'equals', 'regex')),
  pattern text not null,
  category_id uuid references public.categories (id) on delete set null,
  priority integer not null default 100,
  is_active boolean not null default true
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  provider_transaction_id text not null,
  amount numeric not null,
  currency text not null default 'USD',
  posted_at timestamptz not null,
  authorized_at timestamptz null,
  is_pending boolean not null default false,
  description_short text not null,
  description_full text null,
  description_full_expires_at timestamptz null,
  merchant_normalized text,
  category_id uuid null references public.categories (id) on delete set null,
  user_category_id uuid null references public.categories (id) on delete set null,
  tags text[] not null default '{}'::text[],
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (account_id, provider_transaction_id)
);

create index if not exists idx_transactions_user_posted_at_desc
  on public.transactions (user_id, posted_at desc);

create index if not exists idx_transactions_account_posted_at_desc
  on public.transactions (account_id, posted_at desc);

create index if not exists idx_transactions_user_merchant_normalized
  on public.transactions (user_id, merchant_normalized);

create index if not exists idx_rules_user_is_active_priority
  on public.rules (user_id, is_active, priority);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_bank_connections_set_updated_at
before update on public.bank_connections
for each row
execute function public.set_updated_at();

create trigger trg_transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

create or replace function public.set_transaction_description_expiry()
returns trigger
language plpgsql
as $$
declare
  v_days integer;
begin
  if new.description_full is null or btrim(new.description_full) = '' then
    new.description_full_expires_at = null;
    return new;
  end if;

  select up.raw_description_days
    into v_days
  from public.user_preferences up
  where up.user_id = new.user_id;

  if v_days is null then
    v_days = 90;
  end if;

  new.description_full_expires_at = timezone('utc', now()) + make_interval(days => v_days);
  return new;
end;
$$;

create trigger trg_transactions_set_description_expiry
before insert or update of description_full, user_id
on public.transactions
for each row
execute function public.set_transaction_description_expiry();

create or replace function public.purge_expired_transaction_descriptions()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update public.transactions
     set description_full = null,
         description_full_expires_at = null,
         updated_at = timezone('utc', now())
   where description_full is not null
     and description_full_expires_at is not null
     and description_full_expires_at <= timezone('utc', now());

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.bank_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.rules enable row level security;
alter table public.transactions enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles
  for insert
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_delete_own
  on public.profiles
  for delete
  using (id = auth.uid());

create policy user_preferences_select_own
  on public.user_preferences
  for select
  using (user_id = auth.uid());

create policy user_preferences_insert_own
  on public.user_preferences
  for insert
  with check (user_id = auth.uid());

create policy user_preferences_update_own
  on public.user_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_preferences_delete_own
  on public.user_preferences
  for delete
  using (user_id = auth.uid());

create policy bank_connections_select_own
  on public.bank_connections
  for select
  using (user_id = auth.uid());

create policy bank_connections_insert_own
  on public.bank_connections
  for insert
  with check (user_id = auth.uid());

create policy bank_connections_update_own
  on public.bank_connections
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy bank_connections_delete_own
  on public.bank_connections
  for delete
  using (user_id = auth.uid());

create policy accounts_select_own
  on public.accounts
  for select
  using (user_id = auth.uid());

create policy accounts_insert_own
  on public.accounts
  for insert
  with check (user_id = auth.uid());

create policy accounts_update_own
  on public.accounts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy accounts_delete_own
  on public.accounts
  for delete
  using (user_id = auth.uid());

create policy categories_select_own
  on public.categories
  for select
  using (user_id = auth.uid());

create policy categories_insert_own
  on public.categories
  for insert
  with check (user_id = auth.uid());

create policy categories_update_own
  on public.categories
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy categories_delete_own
  on public.categories
  for delete
  using (user_id = auth.uid());

create policy rules_select_own
  on public.rules
  for select
  using (user_id = auth.uid());

create policy rules_insert_own
  on public.rules
  for insert
  with check (user_id = auth.uid());

create policy rules_update_own
  on public.rules
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy rules_delete_own
  on public.rules
  for delete
  using (user_id = auth.uid());

create policy transactions_select_own
  on public.transactions
  for select
  using (user_id = auth.uid());

create policy transactions_insert_own
  on public.transactions
  for insert
  with check (user_id = auth.uid());

create policy transactions_update_own
  on public.transactions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy transactions_delete_own
  on public.transactions
  for delete
  using (user_id = auth.uid());
