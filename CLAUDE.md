# CLAUDE.md - Financial Autopilot

## Project Snapshot

Financial Autopilot is a full-stack personal finance app:
- Frontend: React + TypeScript (Vite)
- Backend: Supabase Postgres + Edge Functions (Deno)
- Bank sync: SimpleFIN

The app is live with real data and currently focused on clean, accurate household finance workflows.

## Repository Layout

```txt
financial-autopilot/
|- apps/web/                  # React SPA (npm workspace)
|  |- src/
|     |- App.tsx              # root routing + nav
|     |- main.tsx             # Vite entry point
|     |- pages/               # route-level pages
|     |- components/          # shared UI + shadcn primitives
|        |- ui/               # shadcn component primitives
|        |- dashboard/        # dashboard-specific components
|        |- transactions/     # transaction filter chips
|        |- subscriptions/    # subscription list components
|        |- cash-flow/        # cash flow calendar components
|        |- rules/            # alias + behavior rule forms
|        |- classification-rules/  # auto-rule forms
|        |- shift-log/        # shift week components
|     |- hooks/               # page/feature hooks
|     |- lib/                 # utilities, clients, formatters
|- supabase/
|  |- migrations/             # SQL migrations (0001–0051)
|  |- functions/              # Edge Functions (Deno)
|     |- _shared/             # shared Deno utilities + unit tests
|     |- simplefin-sync/      # bank transaction ingestion
|     |- simplefin-connect/   # SimpleFIN auth token setup
|     |- analysis-daily/      # daily anomaly + autopilot analysis
|     |- generate-weekly-insights/  # LLM-based weekly digest
|     |- recurring/           # recurring charge detection
|     |- system-health/       # cron job health monitor
|     |- subscription-renewal-alerts/  # upcoming renewal alerts
|     |- weekly-insights/     # (legacy) weekly insight runner
|     |- purge-old-data/      # data retention cleanup
|     |- redact-descriptions/ # PII redaction in descriptions
|     |- hello/               # health check stub
|- schema.sql                 # snapshot of full DB schema
|- docs/                      # supplemental docs (cron setup, etc.)
|- PLAN.md                    # usability audit + improvement backlog
```

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui + Radix UI
- Supabase JS client (auth + PostgREST + RPC)
- Supabase Postgres with RLS
- Supabase Edge Functions (Deno)
- Recharts (charts)
- date-fns (date formatting)
- lucide-react (icons)
- zod (runtime validation)
- Sentry (`@sentry/react`) for error reporting

## Core Commands

From repo root:

```bash
npm install
npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5174
npm --workspace apps/web run build
npm --workspace apps/web run lint

# Unit tests (Deno shared utilities via vitest)
npm test
# Runs: vitest run supabase/functions/_shared/rules_v1.test.ts \
#            supabase/functions/_shared/recurring_v1.test.ts \
#            supabase/functions/_shared/merchant.test.ts
```

Supabase:

```bash
supabase db push
supabase functions deploy <function-name>
supabase secrets set KEY=VALUE
```

## Environment

Frontend (`apps/web/.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FUNCTIONS_URL`
- `VITE_ENABLE_RERUN_DETECTION=true` (required for rerun detection button)
- `VITE_SENTRY_DSN` (optional, if Sentry is enabled)

Edge function secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SIMPLEFIN_ENC_KEY`
- `CRON_SECRET`
- `ALLOWED_ORIGINS` (for CORS allowlist)

## Product Reality (Important)

This is a credit-card-first household.

- Spending should be based on credit card purchase activity.
- Cash flow should be based on checking account inflows/outflows.
- Do not combine both naively in one ledger or spend will be double-counted.

## Page Routes

All routes are defined in `apps/web/src/App.tsx`. Navigation is grouped:

**Main:**
- `/` → `Dashboard` — KPIs, attention card, insights, shifts, savings, renewals
- `/overview` → `Overview` — account list with balances and owner assignment
- `/transactions` → `Transactions` — filterable/paginated transaction feed
- `/cash-flow` → `CashFlow` — day-by-day ledger with projected income + bills
- `/shift-log` → `ShiftLog` — employer shift tracking + weekly pay summary

**Automation:**
- `/subscriptions` → `Subscriptions` — recurring charge detection and review
- `/alerts` → `Alerts` — anomaly and renewal alert triage

**Config:**
- `/rules` → `Rules` — merchant alias + behavior rules
- `/classification-rules` → `ClassificationRules` — auto-categorization rules (v1)
- `/settings` → `Settings` — user data management (purge, etc.)

**Auth/Setup:**
- `/login` → `Login`
- `/connect` → `Connect` — SimpleFIN bank connection setup
- `/home` → `Home`

## Frontend Hooks

Each page has a companion hook that owns all data-fetching and state:

| Hook | Used by |
|------|---------|
| `useDashboard` | Dashboard |
| `useCashFlow` | CashFlow |
| `useShiftLog` | ShiftLog |
| `useSubscriptions` | Subscriptions |
| `useRules` | Rules |
| `useClassificationRules` | ClassificationRules |
| `useTransactionFilterChips` | Transactions |
| `useTransactionSelection` | Transactions |

## Key Library Files (`apps/web/src/lib/`)

| File | Purpose |
|------|---------|
| `supabase.ts` | Supabase client singleton |
| `auth.ts` | `getAccessToken()` with refresh + stale token handling |
| `fetchWithAuth.ts` | Authenticated edge function fetch with 401 retry |
| `functions.ts` | `functionUrl(name)` helper using `VITE_FUNCTIONS_URL` |
| `session.ts` | `useSession()` hook |
| `types.ts` | Shared TypeScript types (see below) |
| `formatting.ts` | `formatCurrency`, `formatShortDate`, etc. |
| `subscriptionFormatters.ts` | Subscription display helpers, `toNumber()` |
| `cashFlowLedger.ts` | Cash flow ledger construction |
| `shiftWeeks.ts` | Shift week grouping/summary utilities |
| `errorReporting.ts` | `captureException()` + `captureMessage()` (Sentry in prod, console in dev) |
| `bankConnections.ts` | `hasActiveSimplefinConnection()` |
| `loginRedirect.ts` | Auth redirect path helper |
| `utils.ts` | General utilities (clsx, etc.) |

## Key Types (`apps/web/src/lib/types.ts`)

- `TransactionRow` — core transaction shape including `type`, `owner`, `is_credit`, `merchant_canonical`
- `SubscriptionRecord` / `SubscriptionHistoryRow` — recurring charge detection records
- `EmployerRecord` / `EmployerLocationRecord` / `ShiftRecord` / `ShiftWeek` — shift log types
- `CashFlowLedgerEntry` / `CashFlowLedgerDay` — cash flow calendar entries
- `CashFlowBillTemplate` / `CashFlowProjectedIncome` / `MonthBalanceRecord` — cash flow inputs
- `Insight` / `InsightType` — weekly insight records
- Owner enum: `'brianna' | 'elaine' | 'household' | 'unknown'`
- Transaction type enum: `'income' | 'expense' | 'transfer' | 'savings'`

## Data Model Notes

`accounts`:
- `type` (from provider)
- `owner` (`brianna | elaine | household`) - user-managed
- `is_credit` - DB-derived

`transactions`:
- `owner` (inherited from account by trigger, with guard)
- `is_credit` (derived/denormalized from account)
- `type` (`income | expense | transfer | savings`)
- `merchant_canonical` — normalized via `normalize_merchant_canonical()` SQL function; collapses variants (Comcast/Xfinity → COMCAST, etc.)
- `merchant_normalized` — lightly cleaned raw form
- `category_source` — `'user' | 'rule' | 'auto' | 'import' | 'unknown'` (tracks how category was set)

## Rule Engines (Both Exist)

1. `transaction_rules` (older/manual UI flow) — alias rules + behavior rules managed in `/rules`
2. `transaction_category_rules_v1` (sync-time auto-categorization) — managed in `/classification-rules`

For ingestion-time automation, prefer `transaction_category_rules_v1`.

Rule matching logic lives in `supabase/functions/_shared/rules_v1.ts` and has unit tests.

Rule types supported by v1:
- `merchant_contains` — substring match on canonical merchant
- `merchant_exact` — exact match
- `merchant_contains_account` — substring match scoped to a specific account
- `merchant_contains_amount_range` — substring match + amount range filter

## Shared Edge Function Utilities (`supabase/functions/_shared/`)

| File | Purpose |
|------|---------|
| `rules_v1.ts` | Category rule matching engine |
| `recurring_v1.ts` | Recurring charge cadence detection |
| `merchant.ts` | Merchant name normalization (mirrors SQL `normalize_merchant_canonical`) |
| `simplefin.ts` | SimpleFIN API client |
| `crypto.ts` | Encryption helpers for SimpleFIN token storage |
| `env.ts` | Typed environment variable accessors |
| `cors.ts` | CORS headers helper |
| `hash.ts` | Hashing utilities |

Unit tests use vitest and run from the repo root via `npm test`.

## Migrations to Keep Mentally Aligned

- `0041`: `transaction_category_rules_v1` table + rule matching
- `0042`: `transactions.type` + `transactions.owner` columns
- `0043`: account owner + transaction owner inheritance trigger
- `0044`: owner/type-aware `dashboard_kpis` + `shift_week_summary`
- `0045`: savings buckets + contributions + `savings_bucket_summary`
- `0046`: seed user categories
- `0047`: `is_credit` derivation and credit-aware KPI logic
- `0048`: inferred opening balance RPC for cash flow
- `0049`: optional account-owner inference by institution pattern
- `0050`: account owner assignment RPC + UI flow
- `0051`: Comcast/Xfinity canonical merchant normalization (aligns SQL with edge-function logic)

## Non-Negotiable Behavior

- `accounts.owner` is user-managed and must not be overwritten by sync.
- Sync should avoid writing user-managed/DB-derived fields when possible.
- Keep trigger-owned logic in DB (owner inheritance, is_credit derivation).
- `merchant_canonical` normalization must stay in sync between the SQL function (`normalize_merchant_canonical`) and the edge-function equivalent (`_shared/merchant.ts`).

## Frontend Conventions

- Thin page components, logic in hooks/components
- Reuse shared helpers from `src/lib` (formatters/auth/error reporting)
- Use shadcn/ui primitives in `src/components/ui`
- Capture errors with `captureException(...)` from `lib/errorReporting` (do not silently fail)
- Use `fetchFunctionWithAuth(name, init)` from `lib/fetchWithAuth` for all edge function calls (handles auth headers, 401 retry, session expiry)
- Use `captureMessage(message, level)` for non-exception telemetry
- Auth guard pattern: check `session?.user` in `useEffect`, redirect to `getLoginRedirectPath()` if not authenticated

## Backend Conventions

- New schema change = new migration file, never rewrite old migrations
- RLS on all user-scoped tables
- Indexes for primary `WHERE` and `JOIN` paths
- Prefer SQL RPC for heavy aggregates/bulk updates
- Cron functions must validate `CRON_SECRET`
- Use `security definer` + `set search_path = public` for RPCs that need elevated access
- Edge functions use `_shared/cors.ts` for CORS and `_shared/env.ts` for typed env access

## Current Priorities

1. Keep sync behavior safe (no overwriting user-managed account ownership)
2. Maintain accurate cash flow vs spending separation
3. Improve owner assignment UX reliability
4. Keep recurring/review workflow simple and explainable
5. Surface actionable "needs attention" signals on the dashboard (see PLAN.md)

## User Setup Assumptions

- Two-person household model: Brianna + Elaine (+ Household shared context)
- Most spending is on credit cards
- Paychecks land in checking accounts
- Goal is a clean, obvious, and accurate workflow with minimal manual maintenance
