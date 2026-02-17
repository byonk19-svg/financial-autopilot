-- Inline category editing support for transactions table.
-- Ensures category relation, update policy, and query index used by filters.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'category_id'
  ) then
    alter table public.transactions
      add column category_id uuid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and confrelid = 'public.categories'::regclass
      and contype = 'f'
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.transactions'::regclass
            and attname = 'category_id'
            and attisdropped = false
        )
      ]
  ) then
    alter table public.transactions
      add constraint transactions_category_id_fk
      foreign key (category_id)
      references public.categories (id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_transactions_user_category_id
  on public.transactions (user_id, category_id);

alter table public.transactions enable row level security;

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
