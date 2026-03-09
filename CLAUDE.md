# CLAUDE.md - Financial Autopilot

## Project Snapshot

Financial Autopilot is a full-stack personal finance app:
- Frontend: React 18 + TypeScript (Vite 7)
- Backend: Supabase Postgres + Edge Functions (Deno)
- Bank sync: SimpleFIN

The app is live with real data and currently focused on clean, accurate household finance workflows for a two-person household (Brianna + Elaine).

## Repository Layout

```txt
financial-autopilot/
|- apps/web/                      # React SPA (Vite monorepo workspace)
|  |- src/
|     |- pages/                   # Route-level page components (14 pages)
|     |- components/              # Feature components + shadcn/ui primitives
|        |- ui/                   # shadcn primitives (button, card, badge, etc.)
|        |- cash-flow/            # Cash flow feature components
|        |- dashboard/            # Dashboard feature components
|        |- rules/                # Manual rules feature components
|        |- classification-rules/ # Auto-categorization rule components
|        |- subscriptions/        # Subscription feature components
|        |- shift-log/            # Shift log feature components
|        |- transactions/         # Transaction filter components
|     |- hooks/                   # Page/feature-level custom hooks (8 hooks)
|     |- lib/                     # Utilities, clients, formatters (14 modules)
|- supabase/
|  |- migrations/                 # SQL migrations (0001â€”0053, never edit old ones)
|  |- functions/                  # Edge Functions (Deno)
|     |- _shared/                 # Shared Deno utilities
|     |- simplefin-sync/          # Bank account + transaction sync
|     |- simplefin-connect/       # SimpleFIN OAuth token exchange
|     |- analysis-daily/          # Daily KPI + anomaly + alert analysis
|     |- generate-weekly-insights/ # Weekly spending pattern insights
|     |- recurring/               # Subscription/recurring detection
|     |- subscription-renewal-alerts/ # Cron: upcoming renewal alerts
|     |- system-health/           # Cron job health check
|     |- purge-old-data/          # Cron: delete old transactions (4+ yr)
|     |- redact-descriptions/     # Cron: redact old transaction descriptions
|     |- weekly-insights/         # Legacy weekly insights (deprecated)
|     |- hello/                   # Ping/test function
```

## Stack

- React 18.2 + TypeScript 5.9 + Vite 7.3
- Tailwind 3.4 + shadcn/ui + Radix UI + CVA
- Supabase JS 2.95 (auth + PostgREST + RPC)
- Supabase Postgres with RLS
- Supabase Edge Functions (Deno)
- React Router v6
- Recharts (charts), date-fns 4, Lucide React (icons)
- Zod 4 (validation), Sentry 10 (error reporting)
- Prettier + prettier-plugin-tailwindcss
- Vitest 3 (unit tests for shared edge function logic)

## Core Commands

From repo root:

```bash
npm install
npm run dev                                                    # starts SPA on 127.0.0.1:5174 (same as line below)
npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5174
npm --workspace apps/web run build
npm --workspace apps/web run lint
npm run test:e2e
npm run test:e2e:a11y
npm run test:e2e:auth
npm run test:unit       # Vitest: unit tests for shared edge function logic
```

Supabase (PowerShell — use `npx.cmd`, not bare `supabase`):

```powershell
npx.cmd supabase db push
npx.cmd supabase functions deploy <function-name>
npx.cmd supabase secrets set KEY=VALUE
```

## Windows + Supabase CLI Runbook

- Do not use `npm install -g supabase` (global install is not supported).
- Use `npx.cmd supabase ...` from the repo root.
- Dev server options:
  - `npm run dev`
  - `npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5174`

Common commands (PowerShell):

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref jefnjglsfxwalkslctns
npx.cmd supabase functions deploy analysis-daily --project-ref jefnjglsfxwalkslctns --no-verify-jwt --use-api
npx.cmd supabase functions deploy simplefin-sync --project-ref jefnjglsfxwalkslctns --no-verify-jwt --use-api
npx.cmd supabase functions list --project-ref jefnjglsfxwalkslctns -o json
```

Important PowerShell syntax:
- Do not wrap project ref in `<...>`; use raw ref only.
- Example: `--project-ref jefnjglsfxwalkslctns`

Cron secret notes:
- `CRON_SECRET` values are write-only in Supabase.
- After setting a new value, store it locally (password manager or local env var) because you cannot read it back.

Trigger and verify cron-protected functions:

```powershell
$cronSecret = "YOUR_CRON_SECRET"
$headers = @{ "x-cron-secret" = $cronSecret; "Content-Type" = "application/json" }
Invoke-RestMethod -Method POST -Uri "https://jefnjglsfxwalkslctns.supabase.co/functions/v1/simplefin-sync" -Headers $headers -Body "{}"
Invoke-RestMethod -Method POST -Uri "https://jefnjglsfxwalkslctns.supabase.co/functions/v1/analysis-daily" -Headers $headers -Body "{}"
```

## Environment

Frontend (`apps/web/.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FUNCTIONS_URL`
- `VITE_ENABLE_RERUN_DETECTION=true` (required for rerun detection button)
- `VITE_SENTRY_DSN` (optional)

Playwright auth environment (user or machine env vars):
- `PLAYWRIGHT_EMAIL`
- `PLAYWRIGHT_PASSWORD`
- `PLAYWRIGHT_AUTH_STATE` (optional; defaults to `.auth/user.json`)

Edge function secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SIMPLEFIN_ENC_KEY`
- `CRON_SECRET`
- `ALLOWED_ORIGINS` (for CORS allowlist)

## E2E + Accessibility Runbook

- Auth setup (one-time or when session expires):
  - `npm run test:e2e:auth:setup`
- Full e2e:
  - `npm run test:e2e`
- Accessibility gate (axe):
  - `npm run test:e2e:a11y`
- Authenticated flow only:
  - `npm run test:e2e:auth`

Accessibility policy:
- `tests/e2e/a11y.spec.ts` fails on `serious` or `critical` WCAG A/AA violations.
- Keep this passing before merging UI changes.

## GSD Planning Baseline

Required planning files now exist under `.planning/`:
- `PROJECT.md`
- `ROADMAP.md`
- `REQUIREMENTS.md`
- `STATE.md`
- Phase directory: `.planning/phases/01-initialize-planning-baseline/`

Phase 1 planning artifacts:
- `01-RESEARCH.md`
- `01-01-PLAN.md`

Useful commands:
- `node C:/Users/byonk/.codex/get-shit-done/bin/gsd-tools.cjs init plan-phase 1`
- `node C:/Users/byonk/.codex/get-shit-done/bin/gsd-tools.cjs init milestone-op`
- `node C:/Users/byonk/.codex/get-shit-done/bin/gsd-tools.cjs phases list`

## Product Reality (Important)

This is a credit-card-first household.

- Spending should be based on credit card purchase activity.
- Cash flow should be based on checking account inflows/outflows.
- Do not combine both naively in one ledger or spend will be double-counted.

## Data Model Notes

`accounts`:
- `type` (from provider)
- `owner` (`brianna | elaine | household`) â€” user-managed, never overwritten by sync
- `is_credit` â€” DB-derived from account type

`transactions`:
- `owner` â€” inherited from account by DB trigger (with guard, never overwritten)
- `is_credit` â€” denormalized from account
- `type` (`income | expense | transfer | savings`)
- `category` â€” user/rule assigned
- `merchant_canonical` â€” normalized merchant name

`subscriptions` (recurring detection output):
- `cadence` (`weekly | monthly | quarterly | yearly | unknown`)
- `classification` (`needs_review | subscription | bill_loan | transfer | ignore`)
- `confidence` â€” detection confidence score

## Rule Engines (Both Exist — Do Not Conflate)

1. `transaction_rules` (applied by `analysis-daily` job) — created via Transactions page UI ("Fix everywhere" button) or Rules page
2. `transaction_category_rules_v1` (applied at sync time) — no UI; manage directly in Supabase dashboard

For ingestion-time automation, prefer `transaction_category_rules_v1`.
Rules in `transaction_rules` apply on the next daily analysis run (or via "Run analysis now" on the Rules page).

### transaction_rules match_type behavior (important)

The rules engine builds a **haystack** by concatenating all three merchant fields:
`normalizeMatchInput("${merchant_canonical} ${merchant_normalized} ${description_short}")`

This means:
- `contains` â€” use for auto-generated rules (e.g. "Fix everywhere", "Hide everywhere"). Checks `haystack.includes(pattern)`.
- `equals` â€” only works if the entire concatenated haystack exactly equals the pattern. Almost never useful in practice; do not use for auto-generated rules.
- `regex` â€” full regex match against the haystack.

**Always use `match_type: 'contains'` for auto-generated rules** created from merchant canonicals.

## Key Database Migrations to Keep Mentally Aligned

| Migration | Description |
|-----------|-------------|
| `0039` | `shift_log`: employers, locations, shifts |
| `0040` | `cash_flow`: bill templates, projected income, month balances |
| `0041` | `transaction_category_rules_v1`: sync-time auto-categorization |
| `0042` | transactions: type, category, owner columns |
| `0043` | `accounts.owner` + transaction owner inheritance trigger |
| `0044` | Owner/type-aware `dashboard_kpis` + `shift_week_summary` |
| `0045` | Savings buckets + contributions + `savings_bucket_summary` |
| `0046` | Seed default user categories |
| `0047` | `is_credit` derivation and credit-aware KPI logic |
| `0048` | Inferred opening balance RPC for cash flow |
| `0049` | Optional account-owner inference by institution pattern |
| `0050` | Account owner assignment RPC + UI flow |
| `0051` | Comcast/Xfinity canonical merchant name fix |
| `0052` | `is_hidden` on transactions + `hide_similar_transactions` RPC + `set_is_hidden` on `transaction_rules` |
| `0053` | Auto-generated rule bug fix: patch `match_type='equals'` to `'contains'` |

## Non-Negotiable Behavior

- `accounts.owner` is user-managed and must not be overwritten by sync.
- Sync should avoid writing user-managed/DB-derived fields (`owner`, `is_credit`).
- Owner inheritance and `is_credit` derivation live in DB triggers â€” do not replicate in app code.
- New schema change = new migration file, never rewrite old migrations.

## Pages (apps/web/src/pages/)

| Page | Route | Purpose |
|------|-------|---------|
| `Dashboard.tsx` | `/` | KPIs, insights, shift summary, system health |
| `Overview.tsx` | `/overview` | Account groups, bank sync status |
| `Transactions.tsx` | `/transactions` | List with filter chips, bulk categorization (50/page) |
| `CashFlow.tsx` | `/cash-flow` | Monthly ledger with bill templates + projected income |
| `ShiftLog.tsx` | `/shift-log` | Hourly wage tracking with weekly goals + employer comparison |
| `Subscriptions.tsx` | `/subscriptions` | Recurring charge detection + classification |
| `Alerts.tsx` | `/alerts` | Alert triage (unusual, duplicate, pace, renewal, spike) |
| `Rules.tsx` | `/rules` | Manual alias + behavior rules |
| `ClassificationRules.tsx` | `/classification-rules` | Sync-time auto-categorization rules (v1 engine) |
| `Settings.tsx` | `/settings` | User data purge |
| `Connect.tsx` | `/connect` | SimpleFIN bank connection setup |
| `Login.tsx` | `/login` | Supabase auth |
| `Home.tsx` | `/home` | Marketing/landing |
| `Feed.tsx` | â€” | Deprecated activity feed |

## Hooks (apps/web/src/hooks/)

| Hook | Purpose |
|------|---------|
| `useDashboard.ts` | KPIs, renewals, anomalies, system health, account sync status |
| `useSubscriptions.ts` | Subscription detection, filtering, classification management |
| `useCashFlow.ts` | Month balance, bill templates, projected income, ledger, thresholds |
| `useShiftLog.ts` | Shift CRUD, employer/location management, weekly goal tracking |
| `useRules.ts` | Alias + behavior rule CRUD with form state |
| `useClassificationRules.ts` | Auto-categorization rule CRUD and toggle |
| `useTransactionFilterChips.ts` | Filter UI state (owner, type, category, date range) |
| `useTransactionSelection.ts` | Multi-select transaction state for bulk operations |

## Lib Utilities (apps/web/src/lib/)

| Module | Purpose |
|--------|---------|
| `types.ts` | All shared TypeScript interfaces |
| `supabase.ts` | Supabase client initialization |
| `session.ts` | `useSession()` hook for auth state |
| `auth.ts` | `getAccessToken()` with refresh logic |
| `formatting.ts` | `formatCurrency`, `formatShortDate`, `formatShortDateTime` |
| `subscriptionFormatters.ts` | Cadence labels, price increase display, monthly equivalents |
| `functions.ts` | `functionUrl()` helper for edge function endpoints |
| `fetchWithAuth.ts` | HTTP client with Bearer token + auto-refresh retry |
| `errorReporting.ts` | `captureException()` / `captureMessage()` via Sentry |
| `bankConnections.ts` | `hasActiveSimplefinConnection()` check |
| `cashFlowLedger.ts` | `buildMonthLedger()`, `findUpcomingLowPoints()`, `getBillsForMonth()` |
| `shiftWeeks.ts` | Week calculation and shift summary logic |
| `loginRedirect.ts` | Auth redirect path logic |
| `utils.ts` | `cn()` (tailwind-merge + clsx) |

## Edge Functions (supabase/functions/)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `simplefin-sync` | Manual/cron | Fetches accounts + transactions from SimpleFIN, applies rules v1 |
| `simplefin-connect` | Manual | OAuth token exchange + encrypted storage |
| `analysis-daily` | Cron | KPIs, anomaly detection, alerts, subscription renewals |
| `generate-weekly-insights` | Cron | Spending pattern insights (opportunities, warnings, projections) |
| `recurring` | Manual/cron | Groups transactions by merchant, calculates cadence + confidence |
| `subscription-renewal-alerts` | Cron | Generates upcoming renewal alerts |
| `system-health` | Manual | Returns cron job health status |
| `purge-old-data` | Cron | Deletes transactions older than 4 years |
| `redact-descriptions` | Cron | Redacts old transaction descriptions after retention period |
| `weekly-insights` | â€” | Legacy, likely deprecated |
| `hello` | Manual | Ping/test |

### Shared Edge Function Utilities (`_shared/`)

| Module | Purpose |
|--------|---------|
| `rules_v1.ts` | Category rule matching (merchant_contains, merchant_exact, amount ranges) |
| `recurring_v1.ts` | V1 subscription detection algorithm |
| `merchant.ts` | Merchant normalization and canonicalization |
| `simplefin.ts` | SimpleFIN API client (`fetchAccounts`, `exchangeSetupToken`) |
| `crypto.ts` | Encrypt/decrypt SimpleFIN tokens (AES-GCM) |
| `hash.ts` | SHA-256 hashing for transaction fingerprints |
| `cors.ts` | CORS headers builder (uses `ALLOWED_ORIGINS` env) |
| `env.ts` | Environment variable getters with validation |
| `recurring.ts` | Older recurring detection (see `recurring_v1.ts`) |

Tests exist for: `rules_v1`, `recurring_v1`, `merchant` (via Vitest).

## Frontend Conventions

- **Thin pages**: route-level pages hold minimal logic, delegate to hooks and components
- **Hooks own data fetching**: all Supabase queries live in hooks, not pages
- **Shared lib first**: use `src/lib` formatters, auth, and error reporting â€” don't reimplement
- **shadcn primitives**: always use components from `src/components/ui/` for consistent styling
- **Error reporting**: call `captureException(...)` on caught errors â€” never silently fail
- **Auth pattern**: `getAccessToken()` for edge function calls; `supabase.auth` for PostgREST
- **No test utilities in prod**: Vitest tests only exist for shared Deno utilities, not the React app

## Backend Conventions

- New schema change = new migration file, never rewrite old migrations
- RLS on all user-scoped tables
- Indexes for primary `WHERE` and `JOIN` paths
- Prefer SQL RPC for heavy aggregates/bulk updates
- Cron functions must validate `CRON_SECRET` before executing
- Edge functions that accept fetch requests must handle CORS using `_shared/cors.ts`
- Merchant normalization must stay consistent between DB (SQL) and edge function (`_shared/merchant.ts`)

## Key TypeScript Types (src/lib/types.ts)

```ts
AccountOption, CategoryOption,
TransactionRow,                     // Full transaction with category, type, owner
InsightType, Insight,               // weekly insight variants
SubscriptionCadence,                // weekly | monthly | quarterly | yearly | unknown
SubscriptionClassification,         // needs_review | subscription | bill_loan | transfer | ignore
SubscriptionRecord,                 // Recurring charge with confidence + next date
EmployerRecord, ShiftRecord,        // Shift log domain types
ShiftWeek, ShiftWeekSummary,        // Weekly shift aggregation
CashFlowTransaction,                // Simplified transaction for ledger
CashFlowBillTemplate,               // Recurring bill/expense projection
CashFlowProjectedIncome,            // Expected paycheck
CashFlowLedgerEntry, CashFlowLedgerDay, // Ledger aggregation
MonthBalanceRecord                  // Month opening balance + threshold
```

## Navigation Structure

Nav is grouped in the sticky header (`App.tsx`):

- **Main**: Dashboard, Transactions, Cash Flow, Accounts (`/overview`)
- **Automation**: Recurring (`/subscriptions`), Alerts
- **Config**: Rules, Recurring Rules (`/classification-rules`), Shift Log, Settings

Note: The route is still `/subscriptions` but the nav label and page heading say "Recurring".
The route is still `/overview` but the nav label and page heading say "Accounts".
Unauthenticated users are redirected to `/login`. Auth state managed via `useSession()`.

## Page Clarifications (important — naming is confusing)

- **Rules** (`/rules`): Manages `transaction_rules` (spending category assignment + merchant aliases). Applied by analysis-daily. Has "Run analysis now" button.
- **Recurring Rules** (`/classification-rules`): Manages `recurring_classification_rules` â€” controls whether a recurring pattern is classified as subscription/bill/transfer/ignore. NOT for spending categories. NOT `transaction_category_rules_v1`.
- **`transaction_category_rules_v1`**: Sync-time spending category rules. Applied when new transactions import. **There is no UI for this table.** Manage via Supabase dashboard directly if needed.

## Categorization Workflow

Transactions start uncategorized. User builds rules over time:

1. Dashboard attention card â†’ "N transactions need categorization" â†’ links to `/transactions?category=__uncategorized__`
2. On the Transactions page, categorize a transaction via the dropdown
3. Follow-up prompt appears:
   - "Past only" â€” calls `apply_category_to_similar` RPC (12-month lookback, no rule saved)
   - "Fix everywhere (past + future)" â€” applies to past AND inserts into `transaction_rules` AND triggers analysis-daily automatically
4. Analysis-daily applies all `transaction_rules` to existing uncategorized transactions

`buildSearchAndCategoryOrFilter()` handles the `__uncategorized__` special value with:
`and(user_category_id.is.null,category_id.is.null)`

Key gap: `transaction_rules` are applied by analysis-daily (nightly + on-demand). New transactions imported by sync use `transaction_category_rules_v1` (no UI). "Fix everywhere" triggers analysis-daily automatically so rules apply immediately, but analysis runs async (~30â€“60s). After clicking "Fix everywhere", the success toast includes a "check Recurring" link. The Recurring page also has a "Re-run detection" button that triggers analysis and reloads.

### Recurring detection requirements

A merchant only appears in the Recurring page if:
1. It has **â‰¥ 2 charges** in the past 180 days (monthly/quarterly) or 730 days (yearly) that fall within amount tolerance (Â±10% of median, min Â±$2)
2. The gaps between charges fall within a cadence window: weekly (5â€“9d), monthly (25â€“35d), quarterly (83â€“97d), yearly (351â€“379d)
3. The merchant's `effective_merchant` key is consistent across charges (not "UNKNOWN")

`set_pattern_classification` on a `transaction_rules` entry overrides the Recurring classification (subscription/bill_loan/transfer) but does NOT force-include a merchant that fails pattern detection. The `CATEGORY_TO_RECURRING_CLASSIFICATION` map in `Transactions.tsx` sets this automatically when "Fix everywhere" is used.

### Per-account recurring split pattern

To split one brand into separate recurring entries by card/account (example: Netflix on 3 cards), use account-scoped `transaction_rules` that set `set_merchant_normalized` to distinct keys per account, such as:

- `NETFLIX CHASE`
- `NETFLIX CITI`
- `NETFLIX WAYFAIR`

Run `analysis-daily` after inserting/updating rules so subscriptions are re-derived.

### Pending transaction behavior

- Transactions may stay `is_pending = true` until the provider emits a posted version.
- Pending rows are excluded from most KPI and recurring calculations.
- UI now supports hiding pending rows by default in Transactions (`Show pending` toggle).

`simplefin-sync` cleanup behavior:
- Safe auto-reconcile archives stale pending rows only when a matching posted row is found.
- One-time forced cleanup is available for operational recovery:
  - Send JSON body with `force_archive_pending_days` in cron mode.

Example:

```powershell
$cronSecret = "YOUR_CRON_SECRET"
$headers = @{ "x-cron-secret" = $cronSecret; "Content-Type" = "application/json" }
$body = @{ force_archive_pending_days = 7 } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://jefnjglsfxwalkslctns.supabase.co/functions/v1/simplefin-sync" -Headers $headers -Body $body
```

## Current Priorities

1. Keep sync behavior safe (no overwriting user-managed account ownership)
2. Maintain accurate cash flow vs spending separation
3. Improve categorization coverage (most transactions start uncategorized; user builds rules over time)
4. Keep recurring/review workflow simple and explainable

## User Setup Assumptions

- Two-person household: Brianna + Elaine (+ Household shared context)
- `owner` values: `brianna | elaine | household`
- Most spending is on credit cards
- Paychecks land in checking accounts
- Goal is a clean, obvious, and accurate workflow with minimal manual maintenance


