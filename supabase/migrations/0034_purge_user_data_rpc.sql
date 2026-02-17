-- Delete all user-scoped application data for the authenticated user.
-- This intentionally keeps the auth.users account itself intact.

create or replace function public.purge_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_alert_feedback_deleted integer := 0;
  v_recurring_events_deleted integer := 0;
  v_recurring_rules_deleted integer := 0;
  v_splits_deleted integer := 0;
  v_alerts_deleted integer := 0;
  v_insights_deleted integer := 0;
  v_feed_items_deleted integer := 0;
  v_feed_prefs_deleted integer := 0;
  v_subscriptions_deleted integer := 0;
  v_metrics_deleted integer := 0;
  v_transactions_deleted integer := 0;
  v_transaction_rules_deleted integer := 0;
  v_rules_deleted integer := 0;
  v_aliases_deleted integer := 0;
  v_categories_deleted integer := 0;
  v_accounts_deleted integer := 0;
  v_bank_connections_deleted integer := 0;
  v_user_prefs_deleted integer := 0;
  v_profiles_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required to purge user data.';
  end if;

  delete from public.alert_feedback where user_id = v_user_id;
  get diagnostics v_alert_feedback_deleted = row_count;

  delete from public.recurring_classification_events where user_id = v_user_id;
  get diagnostics v_recurring_events_deleted = row_count;

  delete from public.recurring_classification_rules where user_id = v_user_id;
  get diagnostics v_recurring_rules_deleted = row_count;

  delete from public.transaction_splits where user_id = v_user_id;
  get diagnostics v_splits_deleted = row_count;

  delete from public.alerts where user_id = v_user_id;
  get diagnostics v_alerts_deleted = row_count;

  delete from public.insights where user_id = v_user_id;
  get diagnostics v_insights_deleted = row_count;

  delete from public.autopilot_feed_items where user_id = v_user_id;
  get diagnostics v_feed_items_deleted = row_count;

  delete from public.autopilot_feed_preferences where user_id = v_user_id;
  get diagnostics v_feed_prefs_deleted = row_count;

  delete from public.subscriptions where user_id = v_user_id;
  get diagnostics v_subscriptions_deleted = row_count;

  delete from public.user_metrics_daily where user_id = v_user_id;
  get diagnostics v_metrics_deleted = row_count;

  delete from public.transactions where user_id = v_user_id;
  get diagnostics v_transactions_deleted = row_count;

  delete from public.transaction_rules where user_id = v_user_id;
  get diagnostics v_transaction_rules_deleted = row_count;

  delete from public.rules where user_id = v_user_id;
  get diagnostics v_rules_deleted = row_count;

  delete from public.merchant_aliases where user_id = v_user_id;
  get diagnostics v_aliases_deleted = row_count;

  delete from public.categories where user_id = v_user_id;
  get diagnostics v_categories_deleted = row_count;

  delete from public.accounts where user_id = v_user_id;
  get diagnostics v_accounts_deleted = row_count;

  delete from public.bank_connections where user_id = v_user_id;
  get diagnostics v_bank_connections_deleted = row_count;

  delete from public.user_preferences where user_id = v_user_id;
  get diagnostics v_user_prefs_deleted = row_count;

  delete from public.profiles where id = v_user_id;
  get diagnostics v_profiles_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'deleted', jsonb_build_object(
      'alert_feedback', v_alert_feedback_deleted,
      'recurring_classification_events', v_recurring_events_deleted,
      'recurring_classification_rules', v_recurring_rules_deleted,
      'transaction_splits', v_splits_deleted,
      'alerts', v_alerts_deleted,
      'insights', v_insights_deleted,
      'autopilot_feed_items', v_feed_items_deleted,
      'autopilot_feed_preferences', v_feed_prefs_deleted,
      'subscriptions', v_subscriptions_deleted,
      'user_metrics_daily', v_metrics_deleted,
      'transactions', v_transactions_deleted,
      'transaction_rules', v_transaction_rules_deleted,
      'rules', v_rules_deleted,
      'merchant_aliases', v_aliases_deleted,
      'categories', v_categories_deleted,
      'accounts', v_accounts_deleted,
      'bank_connections', v_bank_connections_deleted,
      'user_preferences', v_user_prefs_deleted,
      'profiles', v_profiles_deleted
    )
  );
end;
$$;

revoke all on function public.purge_user_data() from public;
grant execute on function public.purge_user_data() to authenticated;

