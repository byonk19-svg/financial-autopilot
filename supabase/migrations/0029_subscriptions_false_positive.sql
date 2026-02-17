-- Mark recurring patterns explicitly as false positives so detection can ignore them.

alter table public.subscriptions
add column if not exists is_false_positive boolean;

update public.subscriptions
set is_false_positive = false
where is_false_positive is null;

alter table public.subscriptions
alter column is_false_positive set default false,
alter column is_false_positive set not null;

create index if not exists idx_subscriptions_user_false_positive
on public.subscriptions (user_id, is_false_positive);
