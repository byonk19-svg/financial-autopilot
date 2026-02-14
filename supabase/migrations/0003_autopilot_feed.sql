-- Autopilot Feed tables for lightweight, no-LLM insights.

create table if not exists public.autopilot_feed_items (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_key text not null check (char_length(btrim(source_key)) > 0),
  item_type text not null check (
    item_type in ('weekly_insight', 'sync_notice', 'rule_suggestion', 'anomaly', 'info')
  ),
  title text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  action_label text null,
  action_url text null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz null,
  unique (user_id, source_key)
);

create table if not exists public.autopilot_feed_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_insights_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_autopilot_feed_items_user_created_at_desc
  on public.autopilot_feed_items (user_id, created_at desc);

create index if not exists idx_autopilot_feed_items_user_is_read_created_at_desc
  on public.autopilot_feed_items (user_id, is_read, created_at desc);

drop trigger if exists trg_autopilot_feed_preferences_set_updated_at
on public.autopilot_feed_preferences;

create trigger trg_autopilot_feed_preferences_set_updated_at
before update on public.autopilot_feed_preferences
for each row
execute function public.set_updated_at();

alter table public.autopilot_feed_items enable row level security;
alter table public.autopilot_feed_preferences enable row level security;

create policy autopilot_feed_items_select_own
  on public.autopilot_feed_items
  for select
  using (user_id = auth.uid());

create policy autopilot_feed_items_insert_own
  on public.autopilot_feed_items
  for insert
  with check (user_id = auth.uid());

create policy autopilot_feed_items_update_own
  on public.autopilot_feed_items
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy autopilot_feed_items_delete_own
  on public.autopilot_feed_items
  for delete
  using (user_id = auth.uid());

create policy autopilot_feed_preferences_select_own
  on public.autopilot_feed_preferences
  for select
  using (user_id = auth.uid());

create policy autopilot_feed_preferences_insert_own
  on public.autopilot_feed_preferences
  for insert
  with check (user_id = auth.uid());

create policy autopilot_feed_preferences_update_own
  on public.autopilot_feed_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy autopilot_feed_preferences_delete_own
  on public.autopilot_feed_preferences
  for delete
  using (user_id = auth.uid());
