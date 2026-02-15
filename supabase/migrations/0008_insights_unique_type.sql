-- Ensure weekly insight idempotency by (user_id, week_of, type).

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, week_of, type
      order by created_at desc, id desc
    ) as rn
  from public.insights
)
delete from public.insights i
using ranked r
where i.id = r.id
  and r.rn > 1;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'insights_user_week_type_title_key'
  ) then
    alter table public.insights
      drop constraint insights_user_week_type_title_key;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'insights_user_week_type_key'
  ) then
    alter table public.insights
      add constraint insights_user_week_type_key
      unique (user_id, week_of, type);
  end if;
end
$$;
