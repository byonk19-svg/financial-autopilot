-- Canonical merchant support for deterministic rule/subscription/alert matching.

create or replace function public.normalize_merchant_canonical(input text)
returns text
language plpgsql
immutable
as $$
declare
  working text := upper(coalesce(input, ''));
begin
  working := regexp_replace(working, '[0-9]', ' ', 'g');
  working := regexp_replace(working, '[^A-Z\s]', ' ', 'g');

  working := regexp_replace(working, '\m(POS|DEBIT|CREDIT|PURCHASE|ONLINE|WEB|WWW|SQ|PAYPAL|VENMO|CASHAPP|AUTH|HOLD)\M', ' ', 'g');
  working := regexp_replace(
    working,
    '\m(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\M',
    ' ',
    'g'
  );

  working := regexp_replace(working, '\s+', ' ', 'g');
  working := trim(working);

  if working like '%APPLE COM BILL%' or working like '%ITUNES%' then
    return 'APPLE';
  end if;
  if working like '%NETFLIX%' then
    return 'NETFLIX';
  end if;
  if working like '%SPOTIFY%' then
    return 'SPOTIFY';
  end if;
  if working like '%AMZN%' or working like '%AMAZON MARKETPLACE%' or working like '%AMAZON%' then
    return 'AMAZON';
  end if;
  if working ~ '(^| )GOOGLE( .*| )SERVICES?( |$)' then
    return 'GOOGLE';
  end if;

  if working = '' then
    return 'UNKNOWN';
  end if;

  return left(array_to_string((string_to_array(working, ' '))[1:3], ' '), 32);
end;
$$;

alter table public.transactions
  add column if not exists merchant_canonical text null;

create index if not exists idx_transactions_user_merchant_canonical
  on public.transactions (user_id, merchant_canonical);

create or replace function public.set_transaction_merchant_canonical()
returns trigger
language plpgsql
as $$
declare
  source_value text;
begin
  source_value := coalesce(
    nullif(new.merchant_canonical, ''),
    nullif(new.merchant_normalized, ''),
    new.description_short,
    ''
  );
  new.merchant_canonical := public.normalize_merchant_canonical(source_value);
  return new;
end;
$$;

drop trigger if exists trg_transactions_set_merchant_canonical on public.transactions;

create trigger trg_transactions_set_merchant_canonical
before insert or update of merchant_canonical, merchant_normalized, description_short
on public.transactions
for each row
execute function public.set_transaction_merchant_canonical();

update public.transactions
set merchant_canonical = public.normalize_merchant_canonical(
  coalesce(
    nullif(merchant_canonical, ''),
    nullif(merchant_normalized, ''),
    description_short,
    ''
  )
)
where merchant_canonical is null
   or merchant_canonical = ''
   or merchant_canonical = 'UNKNOWN';

-- Keep apply_rule aligned with canonical merchant matching.
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
