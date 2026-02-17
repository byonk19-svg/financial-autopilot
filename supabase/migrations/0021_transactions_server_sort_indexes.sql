-- Server-side sorting support for transactions page.
-- Keep user-scoped indexes aligned with sortable columns.

create index if not exists idx_transactions_user_posted_at_desc
  on public.transactions (user_id, posted_at desc);

create index if not exists idx_transactions_user_amount
  on public.transactions (user_id, amount);

create index if not exists idx_transactions_user_merchant_normalized
  on public.transactions (user_id, merchant_normalized);
