-- Assign account-level owners by institution:
--   Chase checking  → brianna
--   Cy-Fair / CyFair FCU → elaine
--
-- The account owner propagates to every transaction on that account via the
-- trigger installed in 0043 (trg_transactions_inherit_owner_from_account).
-- Only transactions still at the default 'household' are touched; any row
-- already explicitly marked brianna/elaine/household is left alone.

-- ─── 1. Update account owners ────────────────────────────────────────────────

update public.accounts
set owner = 'brianna'
where is_credit = false
  and (
    lower(institution) like '%chase%'
    or lower(name)        like '%chase%'
  );

update public.accounts
set owner = 'elaine'
where is_credit = false
  and (
    lower(institution) like '%cy fair%'
    or lower(institution) like '%cyfair%'
    or lower(institution) like '%cy-fair%'
    or lower(name)        like '%cy fair%'
    or lower(name)        like '%cyfair%'
    or lower(name)        like '%cy-fair%'
  );

-- ─── 2. Backfill transactions that are still at the household default ─────────
-- Only rows with owner = 'household' are updated so any manual overrides
-- (e.g. employer payroll tagged by the 0042 heuristic) are preserved.

update public.transactions t
set owner = a.owner
from public.accounts a
where a.id        = t.account_id
  and a.owner    <> 'household'
  and t.owner     = 'household'
  and t.is_deleted = false;
