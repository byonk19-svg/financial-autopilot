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
│   │   │   └── ui/            # shadcn/ui primitives (button, card, badge, etc.)
│   │   ├── lib/               # Supabase client, hooks, utilities
│   │   └── assets/            # Static assets
│   ├── public/                # Served statically
│   ├── vite.config.ts         # Vite config with @/ path alias
│   ├── tailwind.config.js     # Tailwind with dark mode + CSS variables
│   ├── tsconfig.app.json      # Strict TypeScript config
│   └── eslint.config.js       # ESLint flat config
├── supabase/
│   ├── config.toml            # Supabase project config
│   ├── migrations/            # 18 sequential SQL migrations
│   └── functions/             # Deno edge functions
│       ├── _shared/           # Shared utilities (SimpleFIN client, recurring detection, crypto)
│       ├── simplefin-connect/ # Bank account connection (JWT verified)
│       ├── simplefin-sync/    # Account & transaction sync (cron)
│       ├── analysis-daily/    # Recurring pattern detection (cron)
│       ├── recurring/         # Subscription CRUD API
│       ├── generate-weekly-insights/ # Weekly insight generation (cron)
│       ├── redact-descriptions/     # Transaction description cleanup (cron)
│       ├── purge-old-data/    # Data retention enforcement (cron)
│       └── system-health/     # Health check endpoint
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
| `SIMPLEFIN_ENC_KEY` | Encryption key for SimpleFIN access URLs |
| `CRON_SECRET` | Shared secret for cron-triggered functions |

## Architecture & Key Patterns

### Monorepo Layout

npm workspaces with `apps/*`. The root `package.json` pins React 18.2.0 via `overrides`. The web app is at `apps/web/`.

### Frontend Routing

`App.tsx` defines all routes. The root path (`/`) renders the Dashboard. `/dashboard` redirects to `/`. Catch-all (`*`) also redirects to `/`. Auth-gated pages check session via the `useSession()` hook from `lib/session.ts`.

### Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | Dashboard | Stats, upcoming subscriptions, system health, insights feed |
| `/subscriptions` | Subscriptions | Recurring charge management with classification |
| `/transactions` | Transactions | Browse/filter/categorize transactions |
| `/alerts` | Alerts | Financial anomaly notifications |
| `/classification-rules` | ClassificationRules | Rules for auto-classifying recurring charges |
| `/rules` | Rules | Transaction categorization rules + merchant aliases |
| `/connect` | Connect | SimpleFIN bank connection setup |
| `/login` | Login | Auth (magic link + password) |
| `/overview` | Overview | Account balances and sync |
| `/home` | Home | Landing page |

### Supabase Client

Initialized in `lib/supabase.ts` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Edge function URLs are constructed via `lib/functions.ts` using `VITE_FUNCTIONS_URL`.

### Authentication Flow

- `lib/session.ts` exports `useSession()` — a React hook that tracks auth state via `onAuthStateChange`
- Login supports password and magic link modes
- Edge functions use either JWT verification (e.g., `simplefin-connect`) or `CRON_SECRET` header validation (cron-triggered functions)

### Database

- 18 sequential migrations in `supabase/migrations/` (numbered `0001` through `0018`)
- All tables enforce Row-Level Security (RLS) scoped to `user_id`
- Core tables: `profiles`, `bank_connections`, `accounts`, `transactions`, `subscriptions`, `rules`, `alerts`, `insights`, `categories`, `merchant_aliases`, `recurring_classification_rules`, `autopilot_feed_items`
- Scheduled jobs via `pg_cron`: daily sync, daily description redaction, daily analysis, weekly insights, periodic data purge

### Edge Functions

Functions in `supabase/functions/` each have an `index.ts` entry point. Shared code lives in `_shared/`. Key patterns:
- **JWT-verified functions** (user-initiated): `simplefin-connect`
- **Cron-triggered functions** (validate `CRON_SECRET`): `simplefin-sync`, `analysis-daily`, `redact-descriptions`, `purge-old-data`, `generate-weekly-insights`
- **API functions** (direct invocation): `recurring`, `system-health`

### Recurring Pattern Detection

The `_shared/recurring.ts` module implements statistical cadence detection (weekly, monthly, quarterly, yearly) with confidence scoring based on mean, median, and standard deviation of intervals between charges.

### UI Component Library

Uses shadcn/ui (new-york style) with components in `src/components/ui/`. Configured via `components.json`. Components use `class-variance-authority` for variants and `tailwind-merge` + `clsx` for class composition (via `lib/utils.ts`).

## Code Conventions

### TypeScript

- **Strict mode** enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Target: ES2022, module resolution: bundler
- Path alias: `@/` maps to `src/`
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`)

### Linting

- ESLint 9 flat config with `@eslint/js` recommended + `typescript-eslint` recommended
- React Hooks plugin (recommended) + React Refresh plugin
- Run with `npm run lint` from `apps/web/`

### Styling

- Tailwind CSS 3 with class-based dark mode
- Theme colors defined as HSL CSS variables in `index.css`
- Use `cn()` utility (from `lib/utils.ts`) for conditional class composition
- Follow shadcn/ui patterns for new UI components

### File Organization

- One page component per file in `src/pages/`
- Shared components in `src/components/`
- shadcn/ui primitives in `src/components/ui/`
- Utility modules, hooks, and service clients in `src/lib/`
- Edge function entry points at `supabase/functions/<name>/index.ts`
- Shared edge function utilities at `supabase/functions/_shared/`

### Database Migrations

- Sequential numbering: `NNNN_descriptive_name.sql`
- Use `if not exists` / `create or replace` for idempotency
- Always include RLS policies for new tables
- Apply with `supabase db push`

### Edge Functions

- Deno 2 runtime with TypeScript
- Import Supabase client from `@supabase/supabase-js`
- Shared imports from `../_shared/`
- Cron-triggered functions must validate `CRON_SECRET` from the `Authorization` header
- Return JSON responses with appropriate HTTP status codes

## Testing

No test framework is currently configured. The root `package.json` test script is a placeholder. When adding tests, Vitest is the recommended choice given the Vite build setup.

## Common Tasks

### Adding a new page

1. Create component in `apps/web/src/pages/NewPage.tsx`
2. Add route in `App.tsx` inside `<Routes>`
3. Add navigation link to the `links` array in `App.tsx`

### Adding a shadcn/ui component

Follow the shadcn/ui docs. Components go in `src/components/ui/`. The project uses the `new-york` style with `neutral` base color.

### Adding a new edge function

1. Create `supabase/functions/<name>/index.ts`
2. Add JWT config in `supabase/config.toml` under `[functions.<name>]`
3. Deploy with `supabase functions deploy <name>`

### Adding a database migration

1. Create `supabase/migrations/NNNN_description.sql` (next sequential number)
2. Include RLS policies for any new tables
3. Apply with `supabase db push`

### Calling edge functions from the frontend

Use `functionUrl(name)` from `lib/functions.ts` to build the URL. Pass the user's access token in the `Authorization` header for JWT-verified functions.
