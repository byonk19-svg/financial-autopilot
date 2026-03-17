# Connections Health Handoff

Date: 2026-03-17

## What Changed Recently

- Transactions flow was tightened:
  - viewport-pinned categorization follow-up banner
  - denser desktop/tablet table
  - debounced transaction search
  - visible top nav search removed in favor of hidden `Ctrl+K` command palette
- Security/perf hardening landed:
  - `0060_seed_user_categories_auth_fix.sql`
  - `0061_seed_user_categories_rules_literal_fix.sql`
  - `0062_seed_user_categories_conflict_fix.sql`
  - `0063_dashboard_summary_counts_rpc.sql`
- `Connect.tsx` no longer stores the SimpleFIN setup token in browser storage
- Dashboard was redesigned into a planning-first family finance desk:
  - planner hero with runway / paycheck / bills due / safe-to-spend
  - accessible trend summary table
  - calmer support cards and utility rail

## Current Product Truths

- Spending is credit-card-first.
- Cash flow is checking-account-first.
- Do not combine those naively in one ledger or spend will be double-counted.
- `accounts.owner` is user-managed and must never be overwritten by sync.
- DB triggers own `owner` inheritance and `is_credit` derivation.
- `transaction_rules` and `transaction_category_rules_v1` are different systems:
  - `transaction_rules`: analysis-time rules with UI
  - `transaction_category_rules_v1`: sync-time rules with no UI

## Current Problem To Solve

The dashboard side rail shows stale accounts, but that is only a rough freshness signal based on newest transaction age. It is not a real connection-health workflow.

Users need a first-class place to answer:
- Is this institution still connected?
- Did sync run recently?
- Is the account quiet, or actually stale/broken?
- Does this institution need reconnect?
- Should I run `Sync now` or `Repair last 6 months`?

## Recommendation

Build a dedicated `Connections` page instead of folding this into `Overview`.

Why:
- `Overview` is for balances/account grouping
- this workflow is diagnosis and repair
- the dashboard freshness rail should stay lightweight and link deeper

## Existing Code Seams

Start here:
- `apps/web/src/pages/Connect.tsx`
- `apps/web/src/hooks/useDashboard.sync.ts`
- `apps/web/src/lib/bankConnections.ts`
- `apps/web/src/pages/Overview.tsx`
- `apps/web/src/hooks/useOverview.ts`
- `supabase/functions/simplefin-sync/index.ts`
- `apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx`

Likely supporting files:
- `apps/web/src/App.tsx`
- `apps/web/src/lib/types.ts`
- relevant Supabase tables/RPCs already used by `Overview` and dashboard freshness logic

## Desired Connections Page Behavior

Show each connected institution / imported account with:
- institution/account name
- current balance if already available
- last successful sync
- newest posted transaction date
- status:
  - healthy
  - syncing
  - quiet
  - stale
  - reconnect required

Provide actions:
- `Sync now`
- `Repair last 6 months`
- `Reconnect`
- `Disconnect` only if already supported safely

Design guidance:
- diagnostic and trustworthy, not flashy
- make `quiet` and `stale` visually distinct
- keep the page operationally useful on desktop first

## Constraints

- Preserve the existing sync/connect architecture.
- Do not move ownership logic into the app layer.
- Do not invent health heuristics that pretend to know more than the data supports.
- If richer sync-run history is needed, add it deliberately rather than guessing from transaction timestamps.

## Verification Notes

Recently verified:
- `npm.cmd run lint --workspace web`
- `npm.cmd run build --workspace web`
- dashboard unit tests around planner hero / trend / utility rail

Known limitation:
- automated authenticated browser QA still redirects to `/connect` in the available Playwright auth state, so populated connected-account QA needs a real user session

## Good Next Prompt

`Read CLAUDE.md and docs/superpowers/handoffs/2026-03-17-connections-health-handoff.md, then design and implement a dedicated Connections page for SimpleFIN account health using the existing sync/connect infrastructure. Prefer a dedicated page over folding this into Overview.`
