-- Owner/type-aware dashboard KPI RPCs and weekly shift summary.

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

create or replace function public.shift_week_summary(week_start date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_week_start date := coalesce(week_start, date_trunc('week', timezone('utc', now()))::date);
  v_week_end date := v_week_start + 6;
  v_shifts jsonb := '[]'::jsonb;
  v_employer_breakdown jsonb := '[]'::jsonb;
  v_total_hours numeric := 0;
  v_total_gross_pay numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  with scoped_shifts as (
    select
      s.id as shift_id,
      e.name as employer_name,
      el.name as location_name,
      s.shift_date,
      null::text as clock_in,
      null::text as clock_out,
      s.hours_worked,
      s.gross_pay,
      case when s.is_non_pay then 'non_pay' else 'worked' end as status
    from public.shifts s
    join public.employers e
      on e.id = s.employer_id
      and e.user_id = s.user_id
    left join public.employer_locations el
      on el.id = s.location_id
      and el.user_id = s.user_id
    where s.user_id = v_user_id
      and s.shift_date >= v_week_start
      and s.shift_date <= v_week_end
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'shift_id', shift_id,
          'employer_name', employer_name,
          'location_name', location_name,
          'shift_date', shift_date,
          'clock_in', clock_in,
          'clock_out', clock_out,
          'hours_worked', round(hours_worked, 2),
          'gross_pay', round(gross_pay, 2),
          'status', status
        )
        order by shift_date asc, shift_id asc
      ),
      '[]'::jsonb
    ),
    coalesce(round(sum(hours_worked), 2), 0),
    coalesce(round(sum(gross_pay), 2), 0)
  into
    v_shifts,
    v_total_hours,
    v_total_gross_pay
  from scoped_shifts;

  with breakdown as (
    select
      e.name as employer_name,
      round(sum(s.hours_worked), 2) as hours,
      round(sum(s.gross_pay), 2) as gross_pay
    from public.shifts s
    join public.employers e
      on e.id = s.employer_id
      and e.user_id = s.user_id
    where s.user_id = v_user_id
      and s.shift_date >= v_week_start
      and s.shift_date <= v_week_end
    group by e.name
    order by gross_pay desc, e.name asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'employer_name', employer_name,
        'hours', hours,
        'gross_pay', gross_pay
      )
      order by gross_pay desc, employer_name asc
    ),
    '[]'::jsonb
  )
  into v_employer_breakdown
  from breakdown;

  return jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'shifts', v_shifts,
    'total_hours', v_total_hours,
    'total_gross_pay', v_total_gross_pay,
    'employer_breakdown', v_employer_breakdown
  );
end;
$$;

revoke all on function public.shift_week_summary(date) from public;
grant execute on function public.shift_week_summary(date) to authenticated;
