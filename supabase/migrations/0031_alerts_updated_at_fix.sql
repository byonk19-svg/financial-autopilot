-- Fix alerts update failures caused by updated_at trigger without an updated_at column.

alter table public.alerts
add column if not exists updated_at timestamptz not null default now();

update public.alerts
set updated_at = now()
where updated_at is null;
