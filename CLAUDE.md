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
|- apps/web/                  # React SPA
|  |- src/pages/              # route-level pages
|  |- src/components/         # shared UI + shadcn primitives
|  |- src/hooks/              # page/feature hooks
|  |- src/lib/                # utilities, clients, formatters
|- supabase/
|  |- migrations/             # SQL migrations
|  |- functions/              # Edge Functions
|     |- _shared/             # shared Deno utilities
|     |- simplefin-sync/
|     |- simplefin-connect/
|     |- analysis-daily/
|     |- generate-weekly-insights/
|     |- recurring/
|     |- system-health/
```

## Stack

- React 18 + TypeScript + Vite
- Tailwind + shadcn/ui + Radix
- Supabase JS client (auth + PostgREST + RPC)
- Supabase Postgres with RLS
- Supabase Edge Functions (Deno)

## Core Commands

From repo root:

```bash
npm install
npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5174
npm --workspace apps/web run build
npm --workspace apps/web run lint
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

## Data Model Notes

`accounts`:
- `type` (from provider)
- `owner` (`brianna | elaine | household`) - user-managed
- `is_credit` - DB-derived

`transactions`:
- `owner` (inherited from account by trigger, with guard)
- `is_credit` (derived/denormalized from account)
- `type` (`income | expense | transfer | savings`)

## Rule Engines (Both Exist)

1. `transaction_rules` (older/manual UI flow)
2. `transaction_category_rules_v1` (sync-time auto-categorization)

For ingestion-time automation, prefer `transaction_category_rules_v1`.

## Migrations to Keep Mentally Aligned

- `0043`: account owner + transaction owner inheritance trigger
- `0044`: owner/type-aware `dashboard_kpis` + `shift_week_summary`
- `0045`: savings buckets + contributions + `savings_bucket_summary`
- `0047`: `is_credit` derivation and credit-aware KPI logic
- `0048`: inferred opening balance RPC for cash flow
- `0049`: optional account-owner inference by institution pattern
- `0050`: account owner assignment RPC + UI flow

## Non-Negotiable Behavior

- `accounts.owner` is user-managed and must not be overwritten by sync.
- Sync should avoid writing user-managed/DB-derived fields when possible.
- Keep trigger-owned logic in DB (owner inheritance, is_credit derivation).

## Frontend Conventions

- Thin page components, logic in hooks/components
- Reuse shared helpers from `src/lib` (formatters/auth/error reporting)
- Use shadcn/ui primitives in `src/components/ui`
- Capture errors with `captureException(...)` (do not silently fail)

## Backend Conventions

- New schema change = new migration file, never rewrite old migrations
- RLS on all user-scoped tables
- Indexes for primary `WHERE` and `JOIN` paths
- Prefer SQL RPC for heavy aggregates/bulk updates
- Cron functions must validate `CRON_SECRET`

## Current Priorities

1. Keep sync behavior safe (no overwriting user-managed account ownership)
2. Maintain accurate cash flow vs spending separation
3. Improve owner assignment UX reliability
4. Keep recurring/review workflow simple and explainable

## User Setup Assumptions

- Two-person household model: Brianna + Elaine (+ Household shared context)
- Most spending is on credit cards
- Paychecks land in checking accounts
- Goal is a clean, obvious, and accurate workflow with minimal manual maintenance
