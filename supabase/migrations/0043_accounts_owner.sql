-- Anchor transaction owner at the account level.
-- New transactions inherit owner from accounts unless manually overridden.

alter table public.accounts
  add column if not exists owner text not null default 'household';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and conname = 'accounts_owner_check'
  ) then
    alter table public.accounts
      add constraint accounts_owner_check
      check (owner in ('brianna', 'elaine', 'household'));
  end if;
end
$$;

create index if not exists idx_accounts_user_owner
  on public.accounts (user_id, owner);

create or replace function public.set_transaction_owner_from_account()
returns trigger
language plpgsql
as $$
declare
  v_account_owner text;
begin
  -- Respect manual overrides; only inherit while owner is still household.
  if coalesce(new.owner, 'household') <> 'household' then
    return new;
  end if;

  select a.owner
    into v_account_owner
  from public.accounts a
  where a.id = new.account_id
    and a.user_id = new.user_id;

  if found then
    new.owner = coalesce(v_account_owner, 'household');
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_transactions_inherit_owner_from_account'
  ) then
    create trigger trg_transactions_inherit_owner_from_account
      before insert or update of account_id, owner
      on public.transactions
      for each row
      execute function public.set_transaction_owner_from_account();
  end if;
end
$$;

update public.transactions t
set owner = a.owner
from public.accounts a
where t.account_id = a.id
  and t.user_id = a.user_id
  and t.owner = 'household';

alter table public.accounts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accounts'
      and policyname = 'accounts_select_own'
  ) then
    create policy accounts_select_own
      on public.accounts
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accounts'
      and policyname = 'accounts_insert_own'
  ) then
    create policy accounts_insert_own
      on public.accounts
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accounts'
      and policyname = 'accounts_update_own'
  ) then
    create policy accounts_update_own
      on public.accounts
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accounts'
      and policyname = 'accounts_delete_own'
  ) then
    create policy accounts_delete_own
      on public.accounts
      for delete
      using (user_id = auth.uid());
  end if;
end
$$;
