-- Cash flow feature: recurring bills, projected incomes, and monthly opening balances.

create table if not exists public.bill_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount <> 0),
  due_day_of_month smallint not null check (due_day_of_month between 1 and 31),
  account_id uuid null references public.accounts (id) on delete set null,
  category text not null default 'bill' check (category in ('bill', 'expense', 'transfer')),
  color text not null default '#DC2626',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.projected_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expected_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  employer_id uuid null references public.employers (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.month_balances (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key date not null,
  opening_balance numeric(12,2) not null default 0,
  low_balance_threshold numeric(12,2) not null default 500 check (low_balance_threshold >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, month_key)
);

create index if not exists idx_bill_templates_user_active_due_day
  on public.bill_templates (user_id, is_active, due_day_of_month);

create index if not exists idx_bill_templates_user_name
  on public.bill_templates (user_id, name);

create index if not exists idx_projected_incomes_user_active_expected_date
  on public.projected_incomes (user_id, is_active, expected_date);

create index if not exists idx_projected_incomes_user_expected_date
  on public.projected_incomes (user_id, expected_date);

create index if not exists idx_month_balances_user_month
  on public.month_balances (user_id, month_key);

alter table public.bill_templates enable row level security;
alter table public.projected_incomes enable row level security;
alter table public.month_balances enable row level security;

create policy bill_templates_select_own
  on public.bill_templates
  for select
  using (user_id = auth.uid());

create policy bill_templates_insert_own
  on public.bill_templates
  for insert
  with check (user_id = auth.uid());

create policy bill_templates_update_own
  on public.bill_templates
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy bill_templates_delete_own
  on public.bill_templates
  for delete
  using (user_id = auth.uid());

create policy projected_incomes_select_own
  on public.projected_incomes
  for select
  using (user_id = auth.uid());

create policy projected_incomes_insert_own
  on public.projected_incomes
  for insert
  with check (user_id = auth.uid());

create policy projected_incomes_update_own
  on public.projected_incomes
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy projected_incomes_delete_own
  on public.projected_incomes
  for delete
  using (user_id = auth.uid());

create policy month_balances_select_own
  on public.month_balances
  for select
  using (user_id = auth.uid());

create policy month_balances_insert_own
  on public.month_balances
  for insert
  with check (user_id = auth.uid());

create policy month_balances_update_own
  on public.month_balances
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy month_balances_delete_own
  on public.month_balances
  for delete
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_bill_templates_set_updated_at'
  ) then
    create trigger trg_bill_templates_set_updated_at
      before update on public.bill_templates
      for each row
      execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_projected_incomes_set_updated_at'
  ) then
    create trigger trg_projected_incomes_set_updated_at
      before update on public.projected_incomes
      for each row
      execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_month_balances_set_updated_at'
  ) then
    create trigger trg_month_balances_set_updated_at
      before update on public.month_balances
      for each row
      execute function public.set_updated_at();
  end if;
end
$$;
