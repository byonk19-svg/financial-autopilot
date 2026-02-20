-- Keep transaction category columns in sync across RPC paths.

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
    user_category_id = v_rule.set_spending_category_id,
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
      (v_rule.match_type = 'equals' and lower(coalesce(t.merchant_canonical, t.merchant_normalized, t.description_short, '')) = lower(v_rule.pattern))
      or (v_rule.match_type = 'contains' and lower(coalesce(t.merchant_canonical, t.merchant_normalized, t.description_short, '')) like '%' || lower(v_rule.pattern) || '%')
      or (v_rule.match_type = 'regex' and coalesce(t.merchant_canonical, t.merchant_normalized, t.description_short, '') ~* v_rule.pattern)
    );

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.apply_rule(uuid, text) from public;
grant execute on function public.apply_rule(uuid, text) to authenticated;

create or replace function public.apply_category_to_similar(
  merchant_canonical text,
  account_id uuid default null,
  category_id uuid default null,
  lookback_days integer default 365
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_target_merchant text;
  v_account_id uuid := account_id;
  v_category_id uuid := category_id;
  v_lookback_days integer := greatest(1, least(coalesce(lookback_days, 365), 3650));
  v_updated_count integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  v_target_merchant := trim(coalesce(merchant_canonical, ''));
  if v_target_merchant = '' then
    raise exception 'merchant_canonical is required.';
  end if;

  if v_category_id is null then
    raise exception 'category_id is required.';
  end if;

  if not exists (
    select 1
    from public.categories c
    where c.id = v_category_id
      and c.user_id = v_user_id
  ) then
    raise exception 'Category % does not belong to current user.', v_category_id;
  end if;

  v_target_merchant := public.normalize_merchant_canonical(v_target_merchant);

  update public.transactions t
  set
    category_id = v_category_id,
    user_category_id = v_category_id,
    category_source = 'user'
  where t.user_id = v_user_id
    and t.is_deleted = false
    and t.posted_at >= timezone('utc', now()) - make_interval(days => v_lookback_days)
    and (v_account_id is null or t.account_id = v_account_id)
    and lower(
      coalesce(
        nullif(t.merchant_canonical, ''),
        public.normalize_merchant_canonical(coalesce(nullif(t.merchant_normalized, ''), t.description_short, ''))
      )
    ) = lower(v_target_merchant);

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.apply_category_to_similar(text, uuid, uuid, integer) from public;
grant execute on function public.apply_category_to_similar(text, uuid, uuid, integer) to authenticated;

-- Repair already-mismatched rows where one side is null or both differ.
update public.transactions
set user_category_id = category_id
where user_category_id is distinct from category_id;
