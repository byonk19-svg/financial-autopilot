-- Add is_hidden flag to transactions so users can suppress specific charges from the default view.
-- Also adds set_is_hidden to transaction_rules so rules can auto-hide recurring patterns.

alter table public.transactions
  add column if not exists is_hidden boolean not null default false;

create index if not exists idx_transactions_user_is_hidden
  on public.transactions (user_id, is_hidden);

alter table public.transaction_rules
  add column if not exists set_is_hidden boolean not null default false;

-- RPC to bulk-hide all similar past transactions by merchant name.
create or replace function public.hide_similar_transactions(
  merchant_canonical text,
  account_id uuid default null,
  lookback_days int default 365
)
returns int
language plpgsql
security definer
as $$
declare
  updated_count int;
begin
  update public.transactions
  set is_hidden = true
  where user_id = auth.uid()
    and is_hidden = false
    and (
      transactions.merchant_canonical = hide_similar_transactions.merchant_canonical
      or transactions.merchant_normalized = hide_similar_transactions.merchant_canonical
    )
    and (
      hide_similar_transactions.account_id is null
      or transactions.account_id = hide_similar_transactions.account_id
    )
    and posted_at >= now() - (lookback_days || ' days')::interval;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.hide_similar_transactions(text, uuid, int) to authenticated;
