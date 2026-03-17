-- Smoke test for public.seed_user_categories(...)
-- Run in Supabase SQL editor after applying migration 0060.
--
-- 1) Replace USER_A_UUID and USER_B_UUID with two existing auth.users ids.
-- 2) The authenticated caller is USER_A_UUID.
-- 3) The function must ignore the passed USER_B_UUID and seed only USER_A_UUID.
-- 4) This test runs inside a transaction and rolls back.

begin;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);

select public.seed_user_categories('USER_B_UUID'::uuid);

select
  (select count(*) from public.categories where user_id = 'USER_A_UUID'::uuid) as user_a_categories,
  (select count(*) from public.categories where user_id = 'USER_B_UUID'::uuid) as user_b_categories,
  (select count(*) from public.transaction_category_rules_v1 where user_id = 'USER_A_UUID'::uuid) as user_a_rules,
  (select count(*) from public.transaction_category_rules_v1 where user_id = 'USER_B_UUID'::uuid) as user_b_rules;

rollback;
