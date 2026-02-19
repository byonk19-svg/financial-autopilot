-- RPC to assign an owner to an account and backfill its transactions.
-- Called from the Overview page when the user picks an owner for an account.
--
-- Backfill logic:
--   • Setting to brianna/elaine: only update transactions still at 'household'
--     so per-transaction manual overrides are preserved.
--   • Resetting to household: update ALL transactions on this account so the
--     account is fully de-assigned (reverting any previously inherited owner).

create or replace function public.assign_account_owner(
  p_account_id uuid,
  p_owner      text   -- 'brianna' | 'elaine' | 'household'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  if p_owner not in ('brianna', 'elaine', 'household') then
    raise exception 'Invalid owner value: %', p_owner;
  end if;

  -- Update the account (ownership check via user_id).
  update public.accounts
  set owner = p_owner
  where id      = p_account_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Account not found.';
  end if;

  -- Backfill transactions.
  if p_owner = 'household' then
    -- Resetting to household: clear the inherited owner on ALL transactions
    -- for this account so none are left attributed to a specific person.
    update public.transactions
    set owner = 'household'
    where account_id = p_account_id
      and user_id    = v_user_id
      and is_deleted = false;
  else
    -- Assigning to brianna/elaine: only touch rows still at the household
    -- default so any per-transaction manual overrides are preserved.
    update public.transactions
    set owner = p_owner
    where account_id = p_account_id
      and user_id    = v_user_id
      and owner      = 'household'
      and is_deleted = false;
  end if;
end;
$$;

revoke all on function public.assign_account_owner(uuid, text) from public;
grant execute on function public.assign_account_owner(uuid, text) to authenticated;
