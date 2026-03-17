-- Collapse repeated dashboard count queries into one auth-scoped RPC.
-- This keeps the client loader lighter without changing the dashboard UI contract.

create or replace function public.dashboard_summary_counts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_30d timestamptz := timezone('utc', now()) - interval '30 days';
  v_7d timestamptz := timezone('utc', now()) - interval '7 days';
  v_summary jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  with base_tx as (
    select
      t.category_id,
      t.user_category_id,
      t.category_source,
      t.posted_at,
      t.updated_at
    from public.transactions t
    where t.user_id = v_user_id
      and t.is_deleted = false
      and t.is_pending = false
      and coalesce(t.is_hidden, false) = false
      and t.is_credit = true
      and t.type <> 'transfer'
  )
  select jsonb_build_object(
    'uncategorized_transactions',
      count(*) filter (
        where base_tx.category_id is null and base_tx.user_category_id is null
      ),
    'review_subscriptions',
      (
        select count(*)
        from public.subscriptions s
        where s.user_id = v_user_id
          and s.classification = 'needs_review'
      ),
    'unread_alerts',
      (
        select count(*)
        from public.alerts a
        where a.user_id = v_user_id
          and a.is_dismissed = false
          and a.read_at is null
      ),
    'unowned_accounts',
      (
        select count(*)
        from public.accounts a
        where a.user_id = v_user_id
          and a.owner is null
      ),
    'total_eligible_count_30d',
      count(*) filter (where base_tx.posted_at >= v_30d),
    'auto_categorized_count_30d',
      count(*) filter (
        where base_tx.posted_at >= v_30d
          and base_tx.category_source = 'rule'
      ),
    'uncategorized_count_7d',
      count(*) filter (
        where base_tx.posted_at >= v_7d
          and base_tx.category_id is null
          and base_tx.user_category_id is null
      ),
    'manual_fixes_7d',
      count(*) filter (
        where base_tx.updated_at >= v_7d
          and base_tx.category_source = 'user'
      )
  )
  into v_summary
  from base_tx;

  return coalesce(v_summary, jsonb_build_object(
    'uncategorized_transactions', 0,
    'review_subscriptions', 0,
    'unread_alerts', 0,
    'unowned_accounts', 0,
    'total_eligible_count_30d', 0,
    'auto_categorized_count_30d', 0,
    'uncategorized_count_7d', 0,
    'manual_fixes_7d', 0
  ));
end;
$$;

revoke all on function public.dashboard_summary_counts() from public;
grant execute on function public.dashboard_summary_counts() to authenticated;
