-- Allow users to deactivate their own detected subscriptions from the client.

drop policy if exists subscriptions_update_own on public.subscriptions;
create policy subscriptions_update_own
  on public.subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
