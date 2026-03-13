-- Credit-card-first category spending for dashboard visualizations.
-- Spend = credit card purchases only (type='expense', is_credit=true).

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
    and t.type = 'expense'
    and t.is_credit = true
    and t.posted_at >= start_date::timestamptz
    and t.posted_at < (end_date + 1)::timestamptz
  group by coalesce(c.name, 'Uncategorized')
  order by amount desc, category asc;
$$;

revoke all on function public.spend_by_category(date, date) from public;
grant execute on function public.spend_by_category(date, date) to authenticated;
