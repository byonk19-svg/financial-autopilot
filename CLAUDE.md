# CLAUDE.md — Financial Autopilot

## Project Overview

Financial Autopilot is a full-stack personal finance automation platform. It connects to bank accounts via SimpleFIN, detects recurring charges and subscriptions, generates weekly financial insights, and provides a rules engine for transaction categorization. The frontend is a React SPA and the backend runs on Supabase (PostgreSQL + Deno edge functions).

## Repository Structure

```
financial-autopilot/
├── apps/web/                  # React + TypeScript SPA (Vite)
│   ├── src/
│   │   ├── pages/             # Route-level page components
│   │   ├── components/        # Shared components + shadcn/ui
│   │   │   ├── ui/            # shadcn/ui primitives (badge, button, card, dropdown-menu, input, tabs)
│   │   │   ├── dashboard/     # Dashboard-specific sub-components
│   │   │   ├── rules/         # Rules page sub-components
│   │   │   ├── subscriptions/ # Subscriptions page sub-components
│   │   │   ├── transactions/  # Transactions page sub-components
│   │   │   ├── classification-rules/ # Classification rules sub-components
│   │   │   ├── ErrorBoundary.tsx     # Route-level error boundary
│   │   │   └── InsightFeed.tsx       # Insight feed component (dashboard)
│   │   ├── hooks/             # Extracted data-fetching and UI hooks
│   │   └── lib/               # Supabase client, hooks, utilities, types
│   ├── public/                # Served statically
│   ├── vite.config.ts         # Vite config with @/ path alias
│   ├── tailwind.config.js     # Tailwind with dark mode + CSS variables
│   ├── tsconfig.app.json      # Strict TypeScript config
│   └── eslint.config.js       # ESLint flat config
├── supabase/
│   ├── config.toml            # Supabase project config
│   ├── migrations/            # 38 sequential SQL migrations (0001–0038)
│   └── functions/             # Deno edge functions
│       ├── deno.json          # Shared import map (@supabase/supabase-js pinned)
│       ├── _shared/           # Shared utilities
│       │   ├── cors.ts        # CORS header helpers (respects ALLOWED_ORIGINS env)
│       │   ├── crypto.ts      # AES-GCM encryption/decryption (SimpleFIN tokens)
│       │   ├── env.ts         # Typed env var helpers (requireEnv, getSupabaseConfig, etc.)
│       │   ├── hash.ts        # SHA-256 hashing
│       │   ├── merchant.ts    # Merchant name normalization
│       │   └── recurring.ts   # Recurring pattern detection (cadence + confidence)
│       ├── simplefin-connect/ # Bank account connection (JWT verified)
│       ├── simplefin-sync/    # Account & transaction sync (cron)
│       ├── analysis-daily/    # Recurring pattern detection + categorization (cron)
│       ├── recurring/         # Subscription CRUD API
│       ├── weekly-insights/   # Weekly insight generation (cron + manual JWT trigger)
│       ├── generate-weekly-insights/ # Legacy weekly insight function (cron)
│       ├── subscription-renewal-alerts/ # Renewal alert generation (cron)
│       ├── redact-descriptions/     # Transaction description cleanup (cron)
│       ├── purge-old-data/    # Data retention enforcement (cron)
│       ├── system-health/     # Health check endpoint
│       └── hello/             # Minimal test function
├── docs/                      # Additional documentation
└── package.json               # Monorepo root (npm workspaces)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite 7, React Router 6 |
| Styling | Tailwind CSS 3, shadcn/ui (new-york style), Radix UI, Lucide icons |
| Charts | Recharts |
| Validation | Zod |
| Dates | date-fns |
| Error Monitoring | Sentry (`@sentry/react`) |
| Auth | Supabase Auth (magic link + password) |
| Database | PostgreSQL 17 with RLS, pg_cron |
| Backend | Supabase Edge Functions (Deno 2) |
| API | PostgREST (auto-generated) + custom edge functions |

## Development Commands

### Web App (`apps/web/`)

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Supabase

```bash
supabase start                           # Start local Supabase stack
supabase db push                         # Apply all migrations
supabase functions deploy <function>     # Deploy a single edge function
supabase secrets set KEY=VALUE           # Set edge function secrets
```

### From Monorepo Root

```bash
npm install          # Install all workspace dependencies
```

## Environment Variables

### Frontend (`apps/web/.env`)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_FUNCTIONS_URL` | Base URL for edge function invocations |

### Edge Function Secrets

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Provided automatically by Supabase |
| `SUPABASE_ANON_KEY` | Provided automatically by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Provided automatically by Supabase |
| `SIMPLEFIN_ENC_KEY` | Active AES-GCM encryption key for SimpleFIN access URLs |
| `SIMPLEFIN_ENC_KID` | Key ID for the active encryption key (default: `v1`) |
| `SIMPLEFIN_ENC_KEYS_JSON` | JSON object mapping key IDs to keys (for key rotation) |
| `CRON_SECRET` | Shared secret for cron-triggered functions |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (optional; permissive locally) |

## Architecture & Key Patterns

### Monorepo Layout

npm workspaces with `apps/*`. The root `package.json` pins React 18.2.0 via `overrides`. The web app is at `apps/web/`.

### Frontend Routing

`App.tsx` defines all routes. The root path (`/`) renders the Dashboard. `/dashboard` redirects to `/`. Catch-all (`*`) also redirects to `/`. All routes are wrapped in an `ErrorBoundary` component. Auth-gated pages check session via the `useSession()` hook from `lib/session.ts`.

### Navigation Structure

Navigation is grouped into three sections defined by the `navGroups` array in `App.tsx`:

| Group | Items |
|---|---|
| Main | Dashboard (`/`), Overview (`/overview`), Transactions (`/transactions`) |
| Automation | Subscriptions (`/subscriptions`), Alerts (`/alerts`) |
| Config | Rules (`/rules`), Class Rules (`/classification-rules`), Settings (`/settings`), Connect (`/connect`) |

### Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | Dashboard | Stats, upcoming subscriptions, system health, insights feed |
| `/subscriptions` | Subscriptions | Recurring charge management with classification |
| `/transactions` | Transactions | Browse/filter/categorize transactions |
| `/alerts` | Alerts | Financial anomaly notifications |
| `/classification-rules` | ClassificationRules | Rules for auto-classifying recurring charges |
| `/rules` | Rules | Transaction categorization rules + merchant aliases |
| `/settings` | Settings | Account settings and data deletion (danger zone) |
| `/connect` | Connect | SimpleFIN bank connection setup |
| `/login` | Login | Auth (magic link + password) |
| `/overview` | Overview | Account balances and sync |
| `/home` | Home | Landing page |

> **Note:** `src/pages/Feed.tsx` exists but is not currently registered in the router.

### Hooks Directory

Custom hooks live in `src/hooks/` (data-fetching and UI state extracted from page components):

- `useDashboard.ts` — Dashboard KPI and feed data
- `useSubscriptions.ts` — Subscription list with filtering
- `useRules.ts` — Behavior rules and alias rules
- `useClassificationRules.ts` — Recurring classification rules
- `useTransactionFilterChips.ts` — Active filter chips for the transactions view
- `useTransactionSelection.ts` — Row selection state for bulk transaction actions

### Key Library Modules (`src/lib/`)

| Module | Purpose |
|---|---|
| `supabase.ts` | Supabase client (initialized from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `session.ts` | `useSession()` hook — auth state via `onAuthStateChange` |
| `auth.ts` | `getAccessToken()` — smart JWT refresh with expiry buffer and stale-token cleanup |
| `fetchWithAuth.ts` | `fetchFunctionWithAuth()` — fetches edge functions with auto-attached Bearer token; throws `AuthExpiredError` on 401 |
| `functions.ts` | `functionUrl(name)` — builds edge function URL from `VITE_FUNCTIONS_URL` |
| `bankConnections.ts` | `hasActiveSimplefinConnection()` — checks if user has an active SimpleFIN connection |
| `errorReporting.ts` | `captureException()` / `captureMessage()` — Sentry-backed error reporting (console in dev) |
| `types.ts` | Shared TypeScript types (`TransactionRow`, `SubscriptionRecord`, `Insight`, etc.) |
| `subscriptionFormatters.ts` | Display helpers for subscription cadence and classification labels |
| `utils.ts` | `cn()` utility (tailwind-merge + clsx) |

### Supabase Client

Initialized in `lib/supabase.ts`. Edge function URLs are built via `lib/functions.ts`. Authenticated calls to edge functions should use `fetchFunctionWithAuth()` from `lib/fetchWithAuth.ts`, which handles token refresh and 401 handling automatically.

### Authentication Flow

- `lib/session.ts` exports `useSession()` — a React hook that tracks auth state via `onAuthStateChange`
- `lib/auth.ts` exports `getAccessToken()` — retrieves a valid JWT, refreshing if within 5 seconds of expiry; signs out locally if the refresh token is stale
- Login supports password and magic link modes
- Edge functions use either JWT verification or `CRON_SECRET` validation (see Edge Functions below)

### Database

- 38 sequential migrations in `supabase/migrations/` (numbered `0001` through `0038`)
- All tables enforce Row-Level Security (RLS) scoped to `user_id`
- Core tables: `profiles`, `bank_connections`, `accounts`, `transactions`, `subscriptions`, `rules`, `alerts`, `insights`, `categories`, `merchant_aliases`, `recurring_classification_rules`, `autopilot_feed_items`, `alert_feedback`
- Key RPCs: `purge_user_data`, `apply_rule`, `apply_category_to_similar`, `system_health`, dashboard KPI RPCs
- Scheduled jobs via `pg_cron`: daily sync, daily description redaction, daily analysis, weekly insights, subscription renewal alerts, periodic data purge

### Edge Functions

Functions in `supabase/functions/` each have an `index.ts` entry point. Shared code lives in `_shared/`. The `deno.json` import map at `supabase/functions/deno.json` pins the `@supabase/supabase-js` version.

**Function categories:**

| Category | Functions | Auth mechanism |
|---|---|---|
| JWT-verified (user-initiated) | `simplefin-connect` | `Authorization: Bearer <jwt>` |
| Cron-triggered | `simplefin-sync`, `analysis-daily`, `redact-descriptions`, `purge-old-data`, `generate-weekly-insights`, `subscription-renewal-alerts` | `x-cron-secret: <CRON_SECRET>` header |
| Dual-mode (cron + manual JWT) | `weekly-insights` | `x-cron-secret` for cron; `Authorization: Bearer <jwt>` for manual |
| API / open | `recurring`, `system-health`, `hello` | Varies |

> **Important:** Cron functions validate `CRON_SECRET` from the `x-cron-secret` request header (not `Authorization`).

### CORS Handling

`_shared/cors.ts` exports `getCorsHeaders(request, config?)`. Behavior:
- If `ALLOWED_ORIGINS` env var is set: only whitelists those comma-separated origins
- If unset in a dev/local environment (`DENO_ENV=development`): returns `*`
- If unset in production: only reflects `localhost` / `127.0.0.1` origins

### Recurring Pattern Detection

The `_shared/recurring.ts` module implements statistical cadence detection (weekly, monthly, quarterly, yearly) with confidence scoring based on mean, median, and standard deviation of intervals between charges.

### SimpleFIN Encryption

`_shared/crypto.ts` implements AES-GCM encryption of SimpleFIN access URLs. Key rotation is supported via `SIMPLEFIN_ENC_KID` (active key ID) and `SIMPLEFIN_ENC_KEYS_JSON` (JSON keyring). The active key is always merged into the keyring at runtime.

### UI Component Library

Uses shadcn/ui (new-york style) with components in `src/components/ui/`. Configured via `components.json`. Components use `class-variance-authority` for variants and `tailwind-merge` + `clsx` for class composition (via `lib/utils.ts`).

Current shadcn/ui components: `badge`, `button`, `card`, `dropdown-menu`, `input`, `tabs`.

## Code Conventions

### TypeScript

- **Strict mode** enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Target: ES2022, module resolution: bundler
- Path alias: `@/` maps to `src/`
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`)
- Shared domain types live in `src/lib/types.ts`

### Linting

- ESLint 9 flat config with `@eslint/js` recommended + `typescript-eslint` recommended
- React Hooks plugin (recommended) + React Refresh plugin
- Run with `npm run lint` from `apps/web/`

### Styling

- Tailwind CSS 3 with class-based dark mode
- Theme colors defined as HSL CSS variables in `index.css`
- Use `cn()` utility (from `lib/utils.ts`) for conditional class composition
- Follow shadcn/ui patterns for new UI components
- Custom utility class `transition-colors-fast` is used throughout for hover transitions

### Error Reporting

Use `captureException(error, context)` and `captureMessage(message, level)` from `lib/errorReporting.ts`. In development, these log to the console. In production, they send to Sentry. Always pass a `context` object with at least `component` and `action` keys.

### File Organization

- One page component per file in `src/pages/`
- Feature-specific sub-components in `src/components/<feature>/`
- shadcn/ui primitives in `src/components/ui/`
- Custom hooks in `src/hooks/`
- Utility modules, hooks, and service clients in `src/lib/`
- Edge function entry points at `supabase/functions/<name>/index.ts`
- Shared edge function utilities at `supabase/functions/_shared/`

### Database Migrations

- Sequential numbering: `NNNN_descriptive_name.sql` (next is `0039`)
- Use `if not exists` / `create or replace` for idempotency
- Always include RLS policies for new tables
- Apply with `supabase db push`

### Edge Functions

- Deno 2 runtime with TypeScript
- Import Supabase client via the `deno.json` import map: `import { createClient } from "@supabase/supabase-js"`
- Shared imports from `../_shared/`
- Cron-triggered functions must validate `CRON_SECRET` from the `x-cron-secret` request header
- Use `getCorsHeaders()` from `_shared/cors.ts` for all responses
- Use `getSupabaseConfig()` / `requireEnv()` from `_shared/env.ts` for environment variables
- Return JSON responses with appropriate HTTP status codes
- Log errors as JSON objects with `function`, `action`, `user_id`, `message`, and `stack` fields

## Testing

No test framework is currently configured for the frontend. The root `package.json` test script is a placeholder. When adding tests, Vitest is the recommended choice given the Vite build setup.

The edge function `_shared/` directory contains Deno test files (`crypto_test.ts`, `merchant_test.ts`) runnable with `deno test`.

## Common Tasks

### Adding a new page

1. Create component in `apps/web/src/pages/NewPage.tsx`
2. Add route in `App.tsx` inside `<Routes>`
3. Add navigation link to the appropriate group in the `navGroups` array in `App.tsx`

### Adding a shadcn/ui component

Follow the shadcn/ui docs. Components go in `src/components/ui/`. The project uses the `new-york` style with `neutral` base color.

### Adding a new edge function

1. Create `supabase/functions/<name>/index.ts`
2. Add JWT config in `supabase/config.toml` under `[functions.<name>]`
3. Use `getCorsHeaders()` from `_shared/cors.ts` and env helpers from `_shared/env.ts`
4. For cron functions, validate `CRON_SECRET` from the `x-cron-secret` header
5. Deploy with `supabase functions deploy <name>`

### Adding a database migration

1. Create `supabase/migrations/NNNN_description.sql` (next sequential number: `0039`)
2. Include RLS policies for any new tables
3. Apply with `supabase db push`

### Calling edge functions from the frontend

- Use `functionUrl(name)` from `lib/functions.ts` to build the URL
- Use `fetchFunctionWithAuth(name, init)` from `lib/fetchWithAuth.ts` for JWT-protected functions — it handles token refresh and 401 errors automatically
- Catch `AuthExpiredError` to redirect users to `/login` if needed

### Adding a custom hook

Create the hook in `src/hooks/use<Name>.ts`. Data-fetching hooks should use the Supabase client directly or call edge functions via `fetchFunctionWithAuth`. Keep hooks focused on a single concern.
