-- Persistent classification fields for recurring patterns in public.subscriptions.

alter table public.subscriptions
add column if not exists classification text,
add column if not exists user_locked boolean,
add column if not exists classified_at timestamptz,
add column if not exists classified_by uuid references auth.users (id) on delete set null;

-- Backfill existing rows and enforce defaults/nullability.
update public.subscriptions
set classification = 'needs_review'
where classification is null;

update public.subscriptions
set user_locked = false
where user_locked is null;

alter table public.subscriptions
alter column classification set default 'needs_review',
alter column classification set not null,
alter column user_locked set default false,
alter column user_locked set not null;

-- Allowed classification states.
alter table public.subscriptions
drop constraint if exists subscriptions_classification_check;

alter table public.subscriptions
add constraint subscriptions_classification_check
check (classification in ('needs_review', 'subscription', 'bill_loan', 'transfer', 'ignore'));

create index if not exists idx_subscriptions_user_classification
on public.subscriptions (user_id, classification);

create index if not exists idx_subscriptions_user_locked
on public.subscriptions (user_id, user_locked);

-- Auto-stamp classifier metadata when transitioning out of needs_review.
create or replace function public.set_subscription_classification_metadata()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.classification is distinct from 'needs_review' then
      new.classified_at := coalesce(new.classified_at, now());
      if new.classified_by is null and auth.uid() is not null then
        new.classified_by := auth.uid();
      end if;
    end if;
    return new;
  end if;

  if new.classification is distinct from old.classification then
    if new.classification is distinct from 'needs_review' then
      new.classified_at := coalesce(new.classified_at, now());
      if new.classified_by is null and auth.uid() is not null then
        new.classified_by := auth.uid();
      end if;
    else
      new.classified_at := null;
      new.classified_by := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subscriptions_set_classification_metadata on public.subscriptions;
create trigger trg_subscriptions_set_classification_metadata
before insert or update on public.subscriptions
for each row
execute function public.set_subscription_classification_metadata();
