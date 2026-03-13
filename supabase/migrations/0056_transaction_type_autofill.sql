-- Ensure new imports are classified so credit-card spend visualizations work.
-- Rule set (only when type is null):
-- - credit account + negative amount => expense
-- - credit account + positive amount => transfer
-- - non-credit + positive amount => income
-- - non-credit + negative amount => expense

create or replace function public.set_transaction_type_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_credit boolean := false;
begin
  -- Preserve explicit type assignments from app/rules.
  if new.type is not null then
    return new;
  end if;

  if new.account_id is not null then
    select coalesce(a.is_credit, false)
    into v_is_credit
    from public.accounts a
    where a.id = new.account_id;
  end if;

  if new.amount is null then
    return new;
  end if;

  if v_is_credit then
    if new.amount < 0 then
      new.type := 'expense';
    elsif new.amount > 0 then
      new.type := 'transfer';
    end if;
  else
    if new.amount > 0 then
      new.type := 'income';
    elsif new.amount < 0 then
      new.type := 'expense';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transaction_type_default on public.transactions;
create trigger trg_transaction_type_default
  before insert or update of account_id, amount, type
  on public.transactions
  for each row
  execute function public.set_transaction_type_default();

-- One-time backfill for existing null types.
update public.transactions t
set type = case
  when coalesce(a.is_credit, false) = true and t.amount < 0 then 'expense'
  when coalesce(a.is_credit, false) = true and t.amount > 0 then 'transfer'
  when coalesce(a.is_credit, false) = false and t.amount > 0 then 'income'
  when coalesce(a.is_credit, false) = false and t.amount < 0 then 'expense'
  else t.type
end
from public.accounts a
where a.id = t.account_id
  and t.type is null
  and t.is_deleted = false;
