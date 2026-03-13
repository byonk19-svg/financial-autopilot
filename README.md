# Financial Autopilot

Monorepo for a household-finance app built with a React/Vite frontend and Supabase for auth, data, SQL migrations, and Edge Functions.

## Repo Layout

- `apps/web`: frontend for dashboard, transactions, recurring charges, rules, and settings.
- `supabase/migrations`: schema, RPCs, cron schedules, and operational SQL.
- `supabase/functions`: Edge Functions for sync, recurring analysis, insights, and cleanup jobs.
- `tests/e2e`: Playwright smoke, accessibility, and authenticated flow coverage.

## Requirements

- Node.js 20+
- npm 10+
- Supabase CLI for local database and Edge Function work

## Local Setup

1. Run `npm ci`.
2. Create `apps/web/.env.local` from `apps/web/.env.example`.
3. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FUNCTIONS_URL`
4. Start local Supabase with `supabase start` when you need auth, SQL, or functions.
5. Start the frontend with `npm run dev`.

The local app runs on `http://127.0.0.1:5174`.

## Commands

- `npm run dev`
- `npm run test:unit`
- `npm run build --workspace web`
- `npm run test:e2e`
- `npm run test:e2e:a11y`

## Testing Notes

- Unauthenticated Playwright smoke coverage works with mock Supabase env values.
- Authenticated Playwright coverage requires `PLAYWRIGHT_EMAIL` + `PLAYWRIGHT_PASSWORD` or `PLAYWRIGHT_AUTH_STATE`.
- `tests/e2e/create-auth-state.mjs` can generate reusable auth state for local runs.

## Edge Function Auth Model

- User-facing functions should prefer Supabase JWT verification at the platform layer.
- Dual-mode jobs such as sync or analysis may keep `verify_jwt = false` when they must support both cron-secret execution and manual authenticated execution inside the handler.
- Cron-only jobs should validate `x-cron-secret` inside the function.

## Quality Gates

- CI runs unit tests and a web production build before Playwright smoke coverage.
- Frontend linting runs with `npm run lint --workspace web`.
