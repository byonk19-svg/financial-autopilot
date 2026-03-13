-- Keep account credit classification DB-derived from account type.
-- Also propagate account.is_credit changes to transaction rows so
-- credit-card-first spend queries stay reliable.

create or replace function public.derive_account_is_credit(account_type text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(account_type), '') ~ '(credit|card)'
$$;

create or replace function public.set_account_is_credit_from_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_credit := public.derive_account_is_credit(new.type);
  return new;
end;
$$;

drop trigger if exists trg_accounts_set_is_credit_from_type on public.accounts;
create trigger trg_accounts_set_is_credit_from_type
  before insert or update of type
  on public.accounts
  for each row
  execute function public.set_account_is_credit_from_type();

create or replace function public.propagate_transaction_is_credit_from_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transactions t
     set is_credit = new.is_credit
   where t.account_id = new.id
     and t.is_credit is distinct from new.is_credit;

  return new;
end;
$$;

drop trigger if exists trg_accounts_propagate_transaction_is_credit on public.accounts;
create trigger trg_accounts_propagate_transaction_is_credit
  after insert or update of is_credit
  on public.accounts
  for each row
  execute function public.propagate_transaction_is_credit_from_account();

-- One-time backfill for existing data.
update public.accounts a
   set is_credit = public.derive_account_is_credit(a.type)
 where a.is_credit is distinct from public.derive_account_is_credit(a.type);

update public.transactions t
   set is_credit = a.is_credit
  from public.accounts a
 where a.id = t.account_id
   and t.is_credit is distinct from a.is_credit;
