-- Weekly insight feed table.

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('pattern', 'opportunity', 'warning', 'projection')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  week_of date not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  is_dismissed boolean not null default false
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'insights_user_week_type_title_key'
  ) then
    alter table public.insights
      add constraint insights_user_week_type_title_key
      unique (user_id, week_of, type, title);
  end if;
end
$$;

create index if not exists idx_insights_user_week_of_desc on public.insights (user_id, week_of desc);

create index if not exists idx_insights_user_created_at_desc on public.insights (user_id, created_at desc);

alter table public.insights enable row level security;

create policy insights_select_own
  on public.insights
  for select
  using (user_id = auth.uid());

create policy insights_update_own
  on public.insights
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
