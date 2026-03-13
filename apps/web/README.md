# Web App

React 18 + Vite frontend for Financial Autopilot.

## Scripts

- `npm run dev --workspace web -- --host 127.0.0.1 --port 5174`
- `npm run lint --workspace web`
- `npm run build --workspace web`

## Environment

Create `apps/web/.env.local` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FUNCTIONS_URL`

`apps/web/.env.example` contains the expected keys.

## Notes

- The app calls Edge Functions through `fetchFunctionWithAuth`.
- Playwright defaults to `http://127.0.0.1:5174`.
- Repo-wide setup and testing notes live in the root README.
