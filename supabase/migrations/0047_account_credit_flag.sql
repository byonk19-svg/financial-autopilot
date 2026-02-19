-- Distinguish credit card accounts from checking/savings accounts.
-- This fixes double-counting in dashboard KPIs and cash flow for households
-- that pay for most purchases with credit cards:
--   • spend_mtd / top_categories = credit card charges (actual spending)
--   • income_mtd               = deposits into checking/savings (payroll)
--   • cash flow ledger         = checking/savings transactions only

-- ─── 1. accounts.is_credit ──────────────────────────────────────────────────

alter table public.accounts
  add column if not exists is_credit boolean not null default false;

-- Backfill from SimpleFIN-provided type string.
-- SimpleFIN sends values like "credit", "creditCard", "credit card", etc.
update public.accounts
set is_credit = true
where lower(type) ~ '(credit|card)';

-- ─── 2. transactions.is_credit (denormalized from account) ──────────────────

alter table public.transactions
  add column if not exists is_credit boolean not null default false;

-- Trigger: inherit is_credit from the account on every insert/update.
create or replace function public.set_transaction_is_credit_from_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(a.is_credit, false)
  into new.is_credit
  from public.accounts a
  where a.id = new.account_id;
  return new;
end;
$$;

drop trigger if exists trg_transaction_is_credit on public.transactions;
create trigger trg_transaction_is_credit
  before insert or update of account_id
  on public.transactions
  for each row
  execute function public.set_transaction_is_credit_from_account();

-- Backfill existing transactions.
update public.transactions t
set is_credit = a.is_credit
from public.accounts a
where a.id = t.account_id;

-- Index for the new filter used in dashboard and cash flow queries.
create index if not exists idx_transactions_user_is_credit_type_posted
  on public.transactions (user_id, is_credit, type, posted_at desc)
  where is_deleted = false and is_pending = false;

-- ─── 3. dashboard_kpis() — credit-aware spend and income ────────────────────
--
-- spend_mtd / top_categories: credit card account expenses (actual purchases)
-- income_mtd: checking/savings deposits (payroll)
-- cash_flow_mtd: income_mtd − spend_mtd (apples-to-apples household P&L)

create or replace function public.dashboard_kpis(
  start_date date,
  end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_start date := coalesce(start_date, date_trunc('month', timezone('utc', now()))::date);
  v_end date   := coalesce(end_date,   timezone('utc', now())::date);
  v_prev_start date;
  v_prev_end   date;
  v_days_span  integer;
  v_income_mtd     numeric := 0;
  v_income_brianna numeric := 0;
  v_income_elaine  numeric := 0;
  v_spend_mtd      numeric := 0;
  v_cash_flow_mtd  numeric := 0;
  v_spend_prev     numeric := 0;
  v_spend_delta    numeric := 0;
  v_spend_delta_pct numeric := null;
  v_top_categories  jsonb  := '[]'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  if v_end < v_start then
    raise exception 'end_date must be >= start_date.';
  end if;

  v_days_span  := greatest(0, v_end - v_start);
  v_prev_start := (v_start - interval '1 month')::date;
  v_prev_end   := v_prev_start + v_days_span;

  -- Income: deposits into checking / savings accounts (payroll, ACH, etc.)
  -- Spend:  charges on credit card accounts (actual purchases)
  select
    coalesce(sum(case when t.type = 'income' and t.is_credit = false then t.amount else 0 end), 0),
    coalesce(sum(case when t.type = 'income' and t.is_credit = false and t.owner = 'brianna' then t.amount else 0 end), 0),
    coalesce(sum(case when t.type = 'income' and t.is_credit = false and t.owner = 'elaine'  then t.amount else 0 end), 0),
    coalesce(sum(case when t.type = 'expense' and t.is_credit = true  then abs(t.amount) else 0 end), 0)
  into
    v_income_mtd,
    v_income_brianna,
    v_income_elaine,
    v_spend_mtd
  from public.transactions t
  where t.user_id   = v_user_id
    and t.is_deleted = false
    and t.is_pending = false
    and t.posted_at >= v_start::timestamptz
    and t.posted_at <  (v_end + 1)::timestamptz;

  v_cash_flow_mtd := v_income_mtd - v_spend_mtd;

  -- Prior-period spend (credit card expenses only, same day-span).
  select
    coalesce(sum(abs(t.amount)), 0)
  into v_spend_prev
  from public.transactions t
  where t.user_id    = v_user_id
    and t.is_deleted  = false
    and t.is_pending  = false
    and t.type        = 'expense'
    and t.is_credit   = true
    and t.posted_at  >= v_prev_start::timestamptz
    and t.posted_at  <  (v_prev_end + 1)::timestamptz;

  v_spend_delta := v_spend_mtd - v_spend_prev;
  if v_spend_prev > 0 then
    v_spend_delta_pct := v_spend_delta / v_spend_prev;
  end if;

  -- Top categories: credit card expenses only.
  with category_rollup as (
    select
      coalesce(c.name, 'Uncategorized') as category_name,
      sum(abs(t.amount))::numeric        as amount
    from public.transactions t
    left join public.categories c
      on c.id = coalesce(t.user_category_id, t.category_id)
     and c.user_id = v_user_id
    where t.user_id    = v_user_id
      and t.is_deleted  = false
      and t.is_pending  = false
      and t.type        = 'expense'
      and t.is_credit   = true
      and t.posted_at  >= v_start::timestamptz
      and t.posted_at  <  (v_end + 1)::timestamptz
    group by coalesce(c.name, 'Uncategorized')
    order by amount desc, category_name asc
    limit 5
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('category', category_name, 'amount', round(amount, 2))
      order by amount desc, category_name asc
    ),
    '[]'::jsonb
  )
  into v_top_categories
  from category_rollup;

  return jsonb_build_object(
    'start_date',       v_start,
    'end_date',         v_end,
    'income_mtd',       round(v_income_mtd, 2),
    'income_brianna',   round(v_income_brianna, 2),
    'income_elaine',    round(v_income_elaine, 2),
    'spend_mtd',        round(v_spend_mtd, 2),
    'cash_flow_mtd',    round(v_cash_flow_mtd, 2),
    'spend_last_month', round(v_spend_prev, 2),
    'spend_delta',      round(v_spend_delta, 2),
    'spend_delta_pct',  case when v_spend_delta_pct is null then null
                             else round(v_spend_delta_pct, 4) end,
    'top_categories',   v_top_categories
  );
end;
$$;

revoke all on function public.dashboard_kpis(date, date) from public;
grant execute on function public.dashboard_kpis(date, date) to authenticated;
