-- Keep dashboard aggregates aligned with the default transaction view.
-- Hidden transactions should not continue to influence dashboard KPIs,
-- anomaly cards, or spend-by-category summaries.

create or replace function public.dashboard_kpis(
  start_date date,
  end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_start date := coalesce(start_date, date_trunc('month', timezone('utc', now()))::date);
  v_end date := coalesce(end_date, timezone('utc', now())::date);
  v_prev_start date;
  v_prev_end date;
  v_days_span integer;
  v_income_mtd numeric := 0;
  v_income_brianna numeric := 0;
  v_income_elaine numeric := 0;
  v_spend_mtd numeric := 0;
  v_cash_flow_mtd numeric := 0;
  v_spend_prev numeric := 0;
  v_spend_delta numeric := 0;
  v_spend_delta_pct numeric := null;
  v_top_categories jsonb := '[]'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  if v_end < v_start then
    raise exception 'end_date must be >= start_date.';
  end if;

  v_days_span := greatest(0, v_end - v_start);
  v_prev_start := (v_start - interval '1 month')::date;
  v_prev_end := v_prev_start + v_days_span;

  select
    coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0),
    coalesce(sum(case when t.type = 'income' and t.owner = 'brianna' then t.amount else 0 end), 0),
    coalesce(sum(case when t.type = 'income' and t.owner = 'elaine' then t.amount else 0 end), 0),
    coalesce(sum(case when t.type = 'expense' then abs(t.amount) else 0 end), 0)
  into
    v_income_mtd,
    v_income_brianna,
    v_income_elaine,
    v_spend_mtd
  from public.transactions t
  where t.user_id = v_user_id
    and t.is_deleted = false
    and t.is_pending = false
    and coalesce(t.is_hidden, false) = false
    and t.posted_at >= v_start::timestamptz
    and t.posted_at < (v_end + 1)::timestamptz;

  v_cash_flow_mtd := v_income_mtd - v_spend_mtd;

  select
    coalesce(sum(abs(t.amount)), 0)
  into
    v_spend_prev
  from public.transactions t
  where t.user_id = v_user_id
    and t.is_deleted = false
    and t.is_pending = false
    and coalesce(t.is_hidden, false) = false
    and t.type = 'expense'
    and t.posted_at >= v_prev_start::timestamptz
    and t.posted_at < (v_prev_end + 1)::timestamptz;

  v_spend_delta := v_spend_mtd - v_spend_prev;
  if v_spend_prev > 0 then
    v_spend_delta_pct := v_spend_delta / v_spend_prev;
  end if;

  with category_rollup as (
    select
      coalesce(c.name, 'Uncategorized') as category_name,
      sum(abs(t.amount))::numeric as amount
    from public.transactions t
    left join public.categories c
      on c.id = coalesce(t.user_category_id, t.category_id)
      and c.user_id = v_user_id
    where t.user_id = v_user_id
      and t.is_deleted = false
      and t.is_pending = false
      and coalesce(t.is_hidden, false) = false
      and t.type = 'expense'
      and t.posted_at >= v_start::timestamptz
      and t.posted_at < (v_end + 1)::timestamptz
    group by coalesce(c.name, 'Uncategorized')
    order by amount desc, category_name asc
    limit 5
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', category_name,
        'amount', round(amount, 2)
      )
      order by amount desc, category_name asc
    ),
    '[]'::jsonb
  )
  into v_top_categories
  from category_rollup;

  return jsonb_build_object(
    'start_date', v_start,
    'end_date', v_end,
    'income_mtd', round(v_income_mtd, 2),
    'income_brianna', round(v_income_brianna, 2),
    'income_elaine', round(v_income_elaine, 2),
    'spend_mtd', round(v_spend_mtd, 2),
    'cash_flow_mtd', round(v_cash_flow_mtd, 2),
    'spend_last_month', round(v_spend_prev, 2),
    'spend_delta', round(v_spend_delta, 2),
    'spend_delta_pct', case when v_spend_delta_pct is null then null else round(v_spend_delta_pct, 4) end,
    'top_categories', v_top_categories
  );
end;
$$;

revoke all on function public.dashboard_kpis(date, date) from public;
grant execute on function public.dashboard_kpis(date, date) to authenticated;

create or replace function public.anomalies(
  max_rows integer default 5
)
returns table (
  transaction_id uuid,
  posted_at timestamptz,
  merchant_canonical text,
  amount numeric,
  baseline_avg numeric,
  baseline_stddev numeric,
  score numeric,
  reason text
)
language sql
security definer
set search_path = public
as $$
  with tx as (
    select
      t.id as transaction_id,
      t.posted_at,
      coalesce(nullif(t.merchant_canonical, ''), nullif(t.merchant_normalized, ''), t.description_short, 'UNKNOWN') as merchant_canonical,
      abs(t.amount)::numeric as abs_amount
    from public.transactions t
    where t.user_id = auth.uid()
      and t.is_deleted = false
      and t.is_pending = false
      and coalesce(t.is_hidden, false) = false
      and t.amount < 0
      and t.posted_at >= timezone('utc', now()) - interval '225 days'
  ),
  baseline as (
    select
      merchant_canonical,
      count(*)::int as sample_size,
      avg(abs_amount)::numeric as avg_amount,
      stddev_samp(abs_amount)::numeric as stddev_amount
    from tx
    where posted_at < timezone('utc', now()) - interval '45 days'
    group by merchant_canonical
  ),
  recent as (
    select *
    from tx
    where posted_at >= timezone('utc', now()) - interval '45 days'
  ),
  flagged as (
    select
      r.transaction_id,
      r.posted_at,
      r.merchant_canonical,
      r.abs_amount as amount,
      b.avg_amount as baseline_avg,
      b.stddev_amount as baseline_stddev,
      (r.abs_amount / greatest(coalesce(b.avg_amount, 1), 1))::numeric as score
    from recent r
    left join baseline b
      on b.merchant_canonical = r.merchant_canonical
    where
      (
        b.sample_size >= 4
        and (
          r.abs_amount >= greatest(250::numeric, b.avg_amount * 2.2)
          or (coalesce(b.stddev_amount, 0) > 0 and r.abs_amount >= b.avg_amount + (b.stddev_amount * 2.5))
        )
      )
      or (
        coalesce(b.sample_size, 0) < 4
        and r.abs_amount >= 750
      )
  )
  select
    f.transaction_id,
    f.posted_at,
    f.merchant_canonical,
    round(f.amount, 2) as amount,
    case when f.baseline_avg is null then null else round(f.baseline_avg, 2) end as baseline_avg,
    case when f.baseline_stddev is null then null else round(f.baseline_stddev, 2) end as baseline_stddev,
    round(f.score, 2) as score,
    case
      when f.baseline_avg is null then 'High absolute amount with limited merchant history.'
      else format(
        'Amount is %sx merchant average (%s).',
        to_char(round(f.score, 1), 'FM999999990D0'),
        to_char(round(f.baseline_avg, 2), 'FM999999990D00')
      )
    end as reason
  from flagged f
  order by score desc nulls last, amount desc, posted_at desc
  limit greatest(1, least(coalesce(max_rows, 5), 25));
$$;

revoke all on function public.anomalies(integer) from public;
grant execute on function public.anomalies(integer) to authenticated;

create or replace function public.spend_by_category(
  start_date date,
  end_date date
)
returns table(category text, amount numeric)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(c.name, 'Uncategorized')::text as category,
    sum(abs(t.amount))::numeric as amount
  from public.transactions t
  left join public.categories c
    on c.id = coalesce(t.user_category_id, t.category_id)
   and c.user_id = auth.uid()
  where t.user_id = auth.uid()
    and t.is_deleted = false
    and t.is_pending = false
    and coalesce(t.is_hidden, false) = false
    and t.type = 'expense'
    and t.is_credit = true
    and t.posted_at >= start_date::timestamptz
    and t.posted_at < (end_date + 1)::timestamptz
  group by coalesce(c.name, 'Uncategorized')
  order by amount desc, category asc;
$$;

revoke all on function public.spend_by_category(date, date) from public;
grant execute on function public.spend_by_category(date, date) to authenticated;
