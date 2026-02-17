-- Add provenance columns used by expandable transaction details rows in the web app.
-- Keeps existing row-level policies and adds idempotent safeguards.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'category_source'
  ) then
    alter table public.transactions
      add column category_source text null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'rule_id'
  ) then
    alter table public.transactions
      add column rule_id uuid null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_rule_id_fk'
  ) then
    alter table public.transactions
      add constraint transactions_rule_id_fk
      foreign key (rule_id)
      references public.transaction_rules (id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_category_source_check'
  ) then
    alter table public.transactions
      add constraint transactions_category_source_check
      check (
        category_source is null
        or category_source in ('user', 'rule', 'auto', 'import', 'unknown')
      );
  end if;
end
$$;

-- Backfill rule_id from existing classification_rule_ref pointers (e.g. transaction_rule:<uuid>).
update public.transactions
set rule_id = substring(classification_rule_ref from '^transaction_rule:([0-9a-fA-F-]{36})$')::uuid
where rule_id is null
  and classification_rule_ref ~ '^transaction_rule:[0-9a-fA-F-]{36}$';

-- Backfill category_source where we can infer it.
update public.transactions
set category_source = case
  when user_category_id is not null then 'user'
  when rule_id is not null then 'rule'
  when category_id is not null then 'auto'
  else category_source
end
where category_source is null
  and (
    user_category_id is not null
    or rule_id is not null
    or category_id is not null
  );

create index if not exists idx_transactions_user_rule_id
  on public.transactions (user_id, rule_id);

create index if not exists idx_transactions_user_category_source
  on public.transactions (user_id, category_source);

alter table public.transactions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions_select_own'
  ) then
    create policy transactions_select_own
      on public.transactions
      for select
      using (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions_update_own'
  ) then
    create policy transactions_update_own
      on public.transactions
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;
