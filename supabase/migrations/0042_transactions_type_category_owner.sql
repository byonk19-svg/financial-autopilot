-- Add transaction classification columns for owner/type/category views.
-- Includes a one-time heuristic backfill for existing rows.

alter table public.transactions
  add column if not exists type text null,
  add column if not exists category text null,
  add column if not exists owner text not null default 'household';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_type_check'
  ) then
    alter table public.transactions
      add constraint transactions_type_check
      check (
        type is null
        or type in ('income', 'expense', 'transfer', 'savings')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_owner_check'
  ) then
    alter table public.transactions
      add constraint transactions_owner_check
      check (
        owner in ('brianna', 'elaine', 'household', 'unknown')
      );
  end if;
end
$$;

with classified as (
  select
    t.id,
    lower(
      concat_ws(
        ' ',
        coalesce(t.description_short, ''),
        coalesce(t.description_full, ''),
        coalesce(t.merchant_canonical, ''),
        coalesce(t.merchant_normalized, '')
      )
    ) as haystack
  from public.transactions t
)
update public.transactions t
set
  type = case
    when t.type is not null then t.type
    when c.haystack ~ '(hca|hmg|lifepoint|mhtw|hmwb|sltw|knw|fox rehab|fox)' then 'income'
    when c.haystack ~ '(transfer|xfer|zelle|venmo|cash ?app|payment thank you)' then 'transfer'
    when c.haystack ~ '(mortgage|rent|property tax|insurance|electric|water|gas|xfinity|comcast|internet|utility|trash)' then 'expense'
    when t.amount > 0 then 'income'
    when t.amount < 0 then 'expense'
    else null
  end,
  category = case
    when t.category is not null then t.category
    when c.haystack ~ '(hca|hmg|lifepoint|mhtw|hmwb|sltw|knw|fox rehab|fox)' then 'paycheck'
    when c.haystack ~ '(mortgage|rent|property tax|insurance|electric|water|gas|xfinity|comcast|internet|utility|trash)' then 'bill'
    when c.haystack ~ '(transfer|xfer|savings|zelle|venmo|cash ?app)' then 'savings'
    when t.amount > 0 then 'income'
    when t.amount < 0 then 'expense'
    else null
  end,
  owner = case
    when c.haystack ~ '(hca|hmg|lifepoint|mhtw|hmwb|sltw|knw|fox rehab|fox)' and c.haystack ~ '(elaine)' then 'elaine'
    when c.haystack ~ '(hca|hmg|lifepoint|mhtw|hmwb|sltw|knw|fox rehab|fox)' then 'brianna'
    when c.haystack ~ '(transfer|xfer|savings)' then 'brianna'
    when c.haystack ~ '(mortgage|rent|property tax|insurance|electric|water|gas|xfinity|comcast|internet|utility|trash)' then 'household'
    else coalesce(t.owner, 'household')
  end
from classified c
where t.id = c.id
  and (t.type is null or t.category is null or t.owner = 'household');

create index if not exists idx_transactions_user_owner_type_posted_at_desc
  on public.transactions (user_id, owner, type, posted_at desc);

create index if not exists idx_transactions_user_category_text
  on public.transactions (user_id, category);
