alter table public.subscriptions
add column if not exists kind text not null default 'recurring',
add column if not exists is_subscription boolean not null default false;

create index if not exists idx_subscriptions_user_is_subscription
on public.subscriptions (user_id, is_subscription);
