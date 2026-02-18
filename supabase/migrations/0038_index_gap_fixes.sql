-- Performance index additions for common user-scoped filters/sorts.
-- Safe and idempotent: CREATE INDEX IF NOT EXISTS only.

-- bank_connections: common pattern is user -> provider/status checks.
create index if not exists idx_bank_connections_user_provider_status
  on public.bank_connections (user_id, provider, status);

-- alerts: triage filters by type and dismissed state, ordered by recency.
create index if not exists idx_alerts_user_type_dismissed_created_desc
  on public.alerts (user_id, alert_type, is_dismissed, created_at desc);

-- insights: feed reads active (not dismissed) items by recency.
create index if not exists idx_insights_user_not_dismissed_created_desc
  on public.insights (user_id, created_at desc)
  where is_dismissed = false;

-- accounts: account pickers commonly scope by user and sort by name.
create index if not exists idx_accounts_user_name
  on public.accounts (user_id, name);

-- rules: supports user-scoped category joins/filters.
create index if not exists idx_rules_user_category
  on public.rules (user_id, category_id);
