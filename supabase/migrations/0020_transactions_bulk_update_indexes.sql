-- Bulk category updates rely on fast user-scoped id/category lookups.

create index if not exists idx_transactions_user_id_id
  on public.transactions (user_id, id);

create index if not exists idx_transactions_user_category_id
  on public.transactions (user_id, category_id);
