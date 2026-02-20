# Repo Audit + Plan of Attack

This document is a practical plan for improving quality, safety, and polish in **small PRs**.

## Top 15 findings (ranked)

1. **[Critical][Security] SSRF risk when exchanging setup tokens**  
   The backend accepts any `http://` or `https://` URL from decoded setup tokens, then server-side `fetch()` calls it. That can be abused to hit internal/private network endpoints.  
   **Code:** `supabase/functions/_shared/simplefin.ts` → `decodeSetupToken`, `exchangeSetupToken`.

2. **[Critical][Security] SSRF risk when syncing accounts**  
   After setup token exchange, the returned `accessUrl` is only checked as `http(s)` and later fetched directly in `fetchAccounts`. This should be host-allowlisted to SimpleFIN domains only.  
   **Code:** `supabase/functions/_shared/simplefin.ts` → `exchangeSetupToken`, `fetchAccounts`.

3. **[High][Correctness] Rule RPC updates `category_id` but not `user_category_id`**  
   `apply_rule` sets `category_id` and metadata, but does not update `user_category_id`. The app uses both columns, which can lead to inconsistent transaction state after bulk rule runs.  
   **Code:** `supabase/migrations/0025_transactions_merchant_canonical.sql` → `apply_rule`.

4. **[High][Correctness] Similar-category RPC updates `category_id` but not `user_category_id`**  
   Same mismatch as above in `apply_category_to_similar`; this can cause unexpected filtering/display behavior later.  
   **Code:** `supabase/migrations/0026_apply_category_to_similar_rpc.sql` → `apply_category_to_similar`.

5. **[High][Correctness] UI category update only writes `category_id`**  
   The transactions page updates only `category_id` on manual change. This can drift from `user_category_id` and break assumptions in filters and downstream automation.  
   **Code:** `apps/web/src/pages/Transactions.tsx` → `updateTransactionCategory`.

6. **[High][Performance] N+1 updates when applying rules after import**  
   `applyCategoryRulesV1AfterImport` updates one transaction at a time in a loop. For large syncs, this is many DB round trips.  
   **Code:** `supabase/functions/simplefin-sync/index.ts` → `applyCategoryRulesV1AfterImport`.

7. **[High][Performance] Repeated historical backfill can explode API usage**  
   Manual sync backfills all 60-day windows whenever transaction count is `< 50`; this can repeat on each sync and generate many external calls + duplicate processing.  
   **Code:** `supabase/functions/simplefin-sync/index.ts` → sync loop (`buildBackfillWindows`, `fetchAccounts` calls in backfill).

8. **[Medium][Correctness] Invalid transaction dates silently become “now”**  
   `toIsoDate` falls back to current timestamp. Bad provider dates then land in current period and distort reports/cash-flow.  
   **Code:** `supabase/functions/simplefin-sync/index.ts` → `toIsoDate`, call site in transaction mapping.

9. **[Medium][Reliability/Performance] No timeout/retry around provider fetches**  
   External `fetch()` calls to claim and accounts endpoints have no explicit timeout/backoff. Hung providers can tie up function runtime and degrade reliability.  
   **Code:** `supabase/functions/_shared/simplefin.ts` → `exchangeSetupToken`, `fetchAccounts`.

10. **[Medium][Performance] Every transactions query asks for exact count**  
    `.select(..., { count: 'exact' })` on each filter/sort/page interaction is expensive on growing datasets.  
    **Code:** `apps/web/src/pages/Transactions.tsx` → `loadTransactions`.

11. **[Medium][Performance/UX] Search refetches on every keystroke**  
    Search input is in the effect dependency list without debounce, so typing quickly can trigger many network requests and jittery UI.  
    **Code:** `apps/web/src/pages/Transactions.tsx` → `loadTransactions` effect dependencies include `search`.

12. **[Medium][Security/UX] Setup token is persisted in `sessionStorage`**  
    The setup token (sensitive onboarding secret) is saved to `sessionStorage`; if XSS ever occurs, this becomes easier to steal.  
    **Code:** `apps/web/src/pages/Connect.tsx` → setup token persistence effect.

13. **[Low][UX] Onboarding can be skipped too easily**  
    Connect screen has a prominent “Skip to dashboard” even before account connection. For first-time users this can feel broken/confusing.  
    **Code:** `apps/web/src/pages/Connect.tsx`.

14. **[Low][Expected feature gap] No automated end-to-end smoke coverage**  
    Root test scripts only run 2 unit tests for shared logic; no web smoke test suite is present for auth/sync/dashboard critical paths.  
    **Code:** `package.json` scripts.

15. **[Low][Expected feature gap] Missing “data export” user feature**  
    App navigation and routes expose dashboards/transactions/rules/settings, but no export/download route for user financial data (a common expectation in this category).  
    **Code:** `apps/web/src/App.tsx` routes/nav groups.

---

## 5 PRs to do this week (small, high value)

### PR 1 — Lock down SimpleFIN URLs (SSRF fix)
- **Title:** `security: allowlist SimpleFIN domains and enforce https for token exchange/sync`
- **Files touched:**
  - `supabase/functions/_shared/simplefin.ts`
  - `supabase/functions/simplefin-connect/index.ts` (optional error messaging updates)
  - `supabase/functions/simplefin-sync/index.ts` (optional guardrails/logging)
- **Steps:**
  1. Parse URLs with `new URL(...)`.
  2. Require `https:` only.
  3. Add strict hostname allowlist for SimpleFIN endpoints.
  4. Reject private/internal IPs and localhost.
  5. Add unit tests for accepted/rejected URLs.
- **Acceptance criteria:**
  - Non-allowlisted URL is rejected with 400.
  - Existing valid SimpleFIN flow still works.
  - Tests include localhost, private IP, and non-https rejections.

### PR 2 — Keep category columns consistent everywhere
- **Title:** `fix: sync category_id and user_category_id in manual/rule/bulk updates`
- **Files touched:**
  - `supabase/migrations/0025_transactions_merchant_canonical.sql`
  - `supabase/migrations/0026_apply_category_to_similar_rpc.sql`
  - `apps/web/src/pages/Transactions.tsx`
  - new migration file to patch live behavior safely
- **Steps:**
  1. Update RPC `SET` clauses to write both columns.
  2. Update UI category write to send both columns.
  3. Add one backfill SQL migration to repair existing mismatches.
- **Acceptance criteria:**
  - No rows remain where category columns disagree (except intentional null/null).
  - Manual, similar, and rule-based updates all produce same category state.

### PR 3 — Cut sync DB round trips
- **Title:** `perf: batch category-rule updates during simplefin sync`
- **Files touched:**
  - `supabase/functions/simplefin-sync/index.ts`
- **Steps:**
  1. Group rows by target category/rule metadata.
  2. Apply grouped `update ... in (...)` batches.
  3. Keep guard `neq('category_source', 'user')` intact.
- **Acceptance criteria:**
  - Same functional output as before.
  - Fewer DB update calls per sync (log count reduction).

### PR 4 — Add timeout + retry for provider calls
- **Title:** `reliability: add abort timeout and bounded retry for SimpleFIN HTTP calls`
- **Files touched:**
  - `supabase/functions/_shared/simplefin.ts`
- **Steps:**
  1. Add `AbortController` timeout wrapper.
  2. Add small retry policy for transient failures (`429`, `5xx`, network).
  3. Keep retries bounded (e.g., max 2 retries).
- **Acceptance criteria:**
  - Hung requests terminate cleanly.
  - Temporary provider hiccups recover without manual retry.

### PR 5 — Make transactions page feel fast
- **Title:** `perf/ux: debounce transaction search and avoid exact count on each query`
- **Files touched:**
  - `apps/web/src/pages/Transactions.tsx`
- **Steps:**
  1. Debounce search input (250–400ms).
  2. Replace exact count strategy with cheaper pagination approach (or fetch count less often).
  3. Keep current filter/sort behavior unchanged.
- **Acceptance criteria:**
  - Typing in search no longer triggers request per keystroke.
  - Query latency and DB load are reduced.

---

## 5 PRs to do next

### PR 6 — Date quality guardrails
- **Title:** `fix: quarantine malformed provider dates instead of defaulting to now`
- **Files touched:** `supabase/functions/simplefin-sync/index.ts`
- **Steps:**
  1. Change fallback behavior to skip or flag invalid dates.
  2. Add warning counter for malformed records.
- **Acceptance criteria:**
  - Invalid provider dates no longer pollute current-period reporting.

### PR 7 — Backfill only once per user/connection window
- **Title:** `perf: persist backfill progress to prevent repeated historical imports`
- **Files touched:**
  - new migration for tracking table/columns
  - `supabase/functions/simplefin-sync/index.ts`
- **Steps:**
  1. Store last-backfill cursor/checkpoint.
  2. Skip previously completed windows.
- **Acceptance criteria:**
  - Repeated manual sync does not re-fetch the same windows.

### PR 8 — Safer token handling in UI
- **Title:** `security/ux: remove setup token persistence and add copy/paste help`
- **Files touched:** `apps/web/src/pages/Connect.tsx`
- **Steps:**
  1. Stop writing setup token to `sessionStorage`.
  2. Improve validation/help text for token formatting.
- **Acceptance criteria:**
  - Reload clears token.
  - User still has clear guidance to reconnect safely.

### PR 9 — Add basic E2E smoke tests (free tooling)
- **Title:** `test: add minimal Playwright smoke suite for auth + transactions + connect`
- **Files touched:**
  - `apps/web/package.json`
  - `apps/web/tests/smoke/*.spec.ts` (new)
  - optional CI workflow file
- **Steps:**
  1. Add 3-5 happy-path smoke tests.
  2. Run against local/staging Supabase.
- **Acceptance criteria:**
  - CI catches broken login route, broken connect flow, and broken transactions load.

### PR 10 — Add expected “export my data” capability
- **Title:** `feature: add CSV export for filtered transactions`
- **Files touched:**
  - `apps/web/src/pages/Transactions.tsx`
  - optional small helper under `apps/web/src/lib/`
- **Steps:**
  1. Add Export CSV button using current filters.
  2. Export selected columns and date range.
- **Acceptance criteria:**
  - User can download filtered transaction history in one click.

---

## Smoke test checklist (manual)

1. **Auth flow**
   - Log in with valid credentials.
   - Confirm redirect to dashboard.
   - Sign out and confirm route protection behavior.

2. **Connect flow**
   - Open `/connect` logged in.
   - Paste valid setup token and connect.
   - Confirm `bank_connections` row is active and encrypted fields present.

3. **Sync flow**
   - Trigger manual sync.
   - Confirm accounts + transactions upsert without errors.
   - Confirm no obvious duplicates for same `provider_transaction_id`.

4. **Transaction categorization flow**
   - Edit one transaction category in UI.
   - Apply to similar and create rule paths.
   - Verify category consistency in DB (`category_id`, `user_category_id`, `category_source`).

5. **Dashboard/overview sanity**
   - Verify KPIs load.
   - Verify no JS console errors.
   - Verify empty states look clean when data is absent.

6. **Security sanity checks**
   - Try malformed setup token.
   - Try non-SimpleFIN URL token payload (should fail once PR1 is merged).

7. **Performance sanity checks**
   - Type quickly in transactions search.
   - Confirm request count and UI responsiveness are acceptable.
