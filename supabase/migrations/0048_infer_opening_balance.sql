-- Automatically infer the opening balance for a given month from the
-- current synced account balances and the net transaction flow since
-- the start of that month.
--
-- Formula:
--   opening_balance = SUM(checking account balances now)
--                   - SUM(transaction amounts for checking accounts since month start)
--
-- This means the user never has to manually enter an opening balance —
-- after every SimpleFIN sync the estimate stays accurate.
-- Investment / brokerage accounts are excluded (Betterment etc.).

create or replace function public.infer_checking_opening_balance(
  p_month date default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id             uuid;
  v_month_start         date;
  v_current_balance     numeric := 0;
  v_net_since_start     numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  v_month_start := date_trunc('month', coalesce(p_month, current_date))::date;

  -- Current balance across all checking / savings accounts.
  -- Excludes credit cards (is_credit = true) and investment accounts.
  select coalesce(sum(a.balance), 0)
  into v_current_balance
  from public.accounts a
  where a.user_id  = v_user_id
    and a.is_credit = false
    and lower(a.type) not similar to '%(invest|broker|retirement|401|ira|roth|wealth)%';

  -- Net flow in those accounts from month start through today.
  -- Positive = deposits (income), negative = outflows (bills, transfers).
  select coalesce(sum(t.amount), 0)
  into v_net_since_start
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where t.user_id    = v_user_id
    and t.is_deleted  = false
    and t.is_pending  = false
    and t.is_credit   = false
    and lower(a.type) not similar to '%(invest|broker|retirement|401|ira|roth|wealth)%'
    and t.posted_at  >= v_month_start::timestamptz;

  -- Subtract net flow to recover what the balance was on the 1st.
  return round(v_current_balance - v_net_since_start, 2);
end;
$$;

revoke all on function public.infer_checking_opening_balance(date) from public;
grant execute on function public.infer_checking_opening_balance(date) to authenticated;
