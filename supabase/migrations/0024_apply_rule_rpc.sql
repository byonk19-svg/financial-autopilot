-- RPC: apply an existing transaction rule to matching transactions for the current user.
-- Scope options: future_only | past_90_days | all_history

create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Rule',
  match_type text not null default 'contains' check (match_type in ('contains', 'equals', 'regex')),
  pattern text not null,
  account_id uuid null references public.accounts (id) on delete cascade,
  set_spending_category_id uuid null references public.categories (id) on delete set null,
  explanation text null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.transaction_rules
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists name text not null default 'Rule',
  add column if not exists match_type text not null default 'contains',
  add column if not exists pattern text,
  add column if not exists account_id uuid references public.accounts (id) on delete cascade,
  add column if not exists set_spending_category_id uuid references public.categories (id) on delete set null,
  add column if not exists explanation text,
  add column if not exists priority integer not null default 100,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.transaction_rules
set user_id = auth.uid()
where user_id is null and auth.uid() is not null;

alter table public.transaction_rules
  alter column user_id set not null,
  alter column pattern set not null;

create index if not exists idx_transaction_rules_user_active_priority
  on public.transaction_rules (user_id, is_active, priority);

create index if not exists idx_transaction_rules_user_pattern
  on public.transaction_rules (user_id, pattern);

alter table public.transaction_rules enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_rules'
      and policyname = 'transaction_rules_select_own'
  ) then
    create policy transaction_rules_select_own
      on public.transaction_rules
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
      and tablename = 'transaction_rules'
      and policyname = 'transaction_rules_insert_own'
  ) then
    create policy transaction_rules_insert_own
      on public.transaction_rules
      for insert
      with check (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_rules'
      and policyname = 'transaction_rules_update_own'
  ) then
    create policy transaction_rules_update_own
      on public.transaction_rules
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_rules'
      and policyname = 'transaction_rules_delete_own'
  ) then
    create policy transaction_rules_delete_own
      on public.transaction_rules
      for delete
      using (user_id = auth.uid());
  end if;
end
$$;

create or replace function public.apply_rule(rule_id uuid, scope text default 'past_90_days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_rule record;
  v_scope text;
  v_updated_count integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select
    tr.id,
    tr.user_id,
    tr.match_type,
    tr.pattern,
    tr.account_id,
    tr.set_spending_category_id,
    tr.is_active
  into v_rule
  from public.transaction_rules tr
  where tr.id = rule_id;

  if not found then
    raise exception 'Rule % not found.', rule_id;
  end if;

  if v_rule.user_id is distinct from v_user_id then
    raise exception 'Rule % does not belong to current user.', rule_id;
  end if;

  if v_rule.is_active is false then
    raise exception 'Rule % is inactive.', rule_id;
  end if;

  if v_rule.set_spending_category_id is null then
    raise exception 'Rule % has no target category.', rule_id;
  end if;

  v_scope := coalesce(nullif(trim(scope), ''), 'past_90_days');
  if v_scope not in ('future_only', 'past_90_days', 'all_history') then
    raise exception 'Unsupported scope: %', v_scope;
  end if;

  update public.transactions t
  set
    category_id = v_rule.set_spending_category_id,
    rule_id = v_rule.id,
    category_source = 'rule',
    classification_rule_ref = format('transaction_rule:%s', v_rule.id),
    classification_explanation = format(
      'Applied by rule %s (%s match on "%s").',
      v_rule.id,
      v_rule.match_type,
      v_rule.pattern
    )
  where t.user_id = v_user_id
    and t.is_deleted = false
    and (
      (v_scope = 'future_only' and t.posted_at >= timezone('utc', now()))
      or (v_scope = 'past_90_days' and t.posted_at >= timezone('utc', now()) - interval '90 days')
      or (v_scope = 'all_history')
    )
    and (
      v_rule.account_id is null
      or t.account_id = v_rule.account_id
    )
    and (
      (v_rule.match_type = 'equals' and lower(coalesce(t.merchant_normalized, t.description_short, '')) = lower(v_rule.pattern))
      or (v_rule.match_type = 'contains' and lower(coalesce(t.merchant_normalized, t.description_short, '')) like '%' || lower(v_rule.pattern) || '%')
      or (v_rule.match_type = 'regex' and coalesce(t.merchant_normalized, t.description_short, '') ~* v_rule.pattern)
    );

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.apply_rule(uuid, text) from public;
grant execute on function public.apply_rule(uuid, text) to authenticated;
