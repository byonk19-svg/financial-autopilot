-- Apply a manually selected category to similar historical transactions.
-- Similarity is defined by canonical merchant, optional account constraint, and lookback window.

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
