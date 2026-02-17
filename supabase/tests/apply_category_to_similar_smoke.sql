-- Smoke test for public.apply_category_to_similar(...)
-- Run in Supabase SQL editor.
--
-- 1) Replace the UUID below with your auth.users.id.
-- 2) This test runs inside a transaction and rolls back.

begin;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

with seed as (
  select
    t.merchant_canonical,
    t.account_id,
    t.category_id
  from public.transactions t
  where t.user_id = auth.uid()
    and t.is_deleted = false
    and t.merchant_canonical is not null
    and t.merchant_canonical <> ''
    and t.category_id is not null
  order by t.posted_at desc
  limit 1
),
applied as (
  select public.apply_category_to_similar(
    merchant_canonical => (select merchant_canonical from seed),
    account_id => (select account_id from seed),
    category_id => (select category_id from seed),
    lookback_days => 365
  ) as updated_count
)
select updated_count
from applied;

rollback;
