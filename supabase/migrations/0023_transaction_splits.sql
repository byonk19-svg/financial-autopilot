-- Transaction splits for per-line category allocation.
-- Includes deferred balance validation so split totals must match transaction amount.

create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  category_id uuid null references public.categories (id) on delete set null,
  amount numeric not null,
  memo text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_transaction_splits_user_transaction
  on public.transaction_splits (user_id, transaction_id);

create index if not exists idx_transaction_splits_transaction
  on public.transaction_splits (transaction_id);

create index if not exists idx_transaction_splits_user_category
  on public.transaction_splits (user_id, category_id);

create or replace function public.transaction_splits_set_user_scope()
returns trigger
language plpgsql
as $$
declare
  v_transaction_user_id uuid;
begin
  select t.user_id
    into v_transaction_user_id
  from public.transactions t
  where t.id = new.transaction_id;

  if v_transaction_user_id is null then
    raise exception 'Transaction % not found for split row.', new.transaction_id;
  end if;

  if new.user_id is distinct from v_transaction_user_id then
    raise exception 'Split user_id must match transaction owner.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transaction_splits_set_user_scope on public.transaction_splits;
create trigger trg_transaction_splits_set_user_scope
before insert or update of user_id, transaction_id
on public.transaction_splits
for each row
execute function public.transaction_splits_set_user_scope();

drop trigger if exists trg_transaction_splits_set_updated_at on public.transaction_splits;
create trigger trg_transaction_splits_set_updated_at
before update
on public.transaction_splits
for each row
execute function public.set_updated_at();

create or replace function public.transaction_splits_assert_balanced(p_transaction_id uuid)
returns void
language plpgsql
as $$
declare
  v_transaction_amount numeric;
  v_split_total numeric;
  v_split_count integer;
begin
  if p_transaction_id is null then
    return;
  end if;

  select t.amount
    into v_transaction_amount
  from public.transactions t
  where t.id = p_transaction_id;

  if v_transaction_amount is null then
    return;
  end if;

  select count(*), coalesce(sum(ts.amount), 0)
    into v_split_count, v_split_total
  from public.transaction_splits ts
  where ts.transaction_id = p_transaction_id;

  -- No split rows means "not split", so no balance check needed.
  if v_split_count = 0 then
    return;
  end if;

  if v_split_total <> v_transaction_amount then
    raise exception using
      errcode = '23514',
      message = format(
        'Split total (%s) must equal transaction amount (%s) for transaction %s.',
        v_split_total,
        v_transaction_amount,
        p_transaction_id
      );
  end if;
end;
$$;

create or replace function public.transaction_splits_enforce_balanced()
returns trigger
language plpgsql
as $$
begin
  perform public.transaction_splits_assert_balanced(coalesce(new.transaction_id, old.transaction_id));

  if tg_op = 'UPDATE' and old.transaction_id is distinct from new.transaction_id then
    perform public.transaction_splits_assert_balanced(old.transaction_id);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_transaction_splits_enforce_balanced on public.transaction_splits;
create constraint trigger trg_transaction_splits_enforce_balanced
after insert or update or delete
on public.transaction_splits
deferrable initially deferred
for each row
execute function public.transaction_splits_enforce_balanced();

alter table public.transaction_splits enable row level security;

drop policy if exists transaction_splits_select_own on public.transaction_splits;
create policy transaction_splits_select_own
  on public.transaction_splits
  for select
  using (user_id = auth.uid());

drop policy if exists transaction_splits_insert_own on public.transaction_splits;
create policy transaction_splits_insert_own
  on public.transaction_splits
  for insert
  with check (user_id = auth.uid());

drop policy if exists transaction_splits_update_own on public.transaction_splits;
create policy transaction_splits_update_own
  on public.transaction_splits
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists transaction_splits_delete_own on public.transaction_splits;
create policy transaction_splits_delete_own
  on public.transaction_splits
  for delete
  using (user_id = auth.uid());
