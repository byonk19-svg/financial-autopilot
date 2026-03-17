# Dashboard Family Planner Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Dashboard into a planning-first family finance desk with a dominant runway hero, calmer hierarchy, accessible visuals, and deeper workflow links.

**Architecture:** Keep the existing dashboard data sources where possible, but extract a shared planner-summary unit from the current cash-flow logic so the new dashboard hero can use truthful runway metrics without duplicating ledger math. Recompose the Dashboard page around a new top hero, quieter supporting panels, an accessible trend section, and a demoted utility rail with shared semantic status styling.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, existing dashboard hooks/components, existing cash-flow ledger helpers, Vitest.

---

## File Structure

- Create: `apps/web/src/lib/dashboardPlanner.ts`
  - Shared planner-summary derivation for the dashboard hero using existing cash-flow/ledger primitives.
- Create: `apps/web/src/lib/dashboardPlanner.test.ts`
  - Unit tests for runway summary derivation and narrative selection.
- Create: `apps/web/src/components/dashboard/DashboardPlannerHero.tsx`
  - New dominant top section for runway, upcoming bills, and planner narrative.
- Create: `apps/web/src/components/dashboard/DashboardPlannerHero.test.tsx`
  - Structural test for the hero content and semantic summary fallback.
- Create: `apps/web/src/components/dashboard/dashboardStatus.ts`
  - Shared semantic tone helpers/classes for success, warning, danger, and neutral badges/chips.
- Create: `apps/web/src/components/dashboard/dashboardStatus.test.ts`
  - Unit tests for semantic tone mapping.
- Modify: `apps/web/src/hooks/useDashboard.ts`
  - Expose planner-ready summary data while preserving existing dashboard consumers.
- Modify: `apps/web/src/pages/Dashboard.tsx`
  - Recompose the page hierarchy around the new hero and reduced-card layout.
- Modify: `apps/web/src/components/dashboard/DashboardHeader.tsx`
  - Thin the header copy and convert it to action/context-first presentation.
- Modify: `apps/web/src/components/dashboard/DashboardStatsGrid.tsx`
  - Break apart or simplify the current equal-weight KPI wall into lower-priority planning support panels.
- Modify: `apps/web/src/components/dashboard/DashboardMonthlyTrendCard.tsx`
  - Add semantic non-visual summary/table support and reduce color-only signaling.
- Modify: `apps/web/src/components/dashboard/DashboardRecentTransactionsCard.tsx`
  - Reframe as “what changed” with tighter grouping and better scanability.
- Modify: `apps/web/src/components/dashboard/DashboardAttentionCard.tsx`
  - Demote visually and align language to task triage.
- Modify: `apps/web/src/components/dashboard/DashboardAutopilotMetricsCard.tsx`
  - Quiet the card and use shared semantic status treatments.
- Modify: `apps/web/src/components/dashboard/DashboardOwnerResponsibilityCard.tsx`
  - Reframe as a concise monthly responsibility panel.
- Modify: `apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx`
  - Fix zoom/long-content layout fragility and adopt shared semantic status treatments.
- Modify: `apps/web/src/components/dashboard/DashboardSystemHealthCard.tsx`
  - Fix metadata row stacking, reduce reliance on hard-coded colors, and keep utility-rail styling secondary.

## Chunk 1: Shared Planner Summary + Top Hero

### Task 1: Extract a Shared Planner Summary Unit

**Files:**
- Create: `apps/web/src/lib/dashboardPlanner.ts`
- Test: `apps/web/src/lib/dashboardPlanner.test.ts`
- Reference: `apps/web/src/hooks/useCashFlow.ts`
- Reference: `apps/web/src/lib/cashFlowLedger.ts`
- Reference: `apps/web/src/pages/CashFlow.tsx`

- [ ] **Step 1: Write the failing planner-summary unit tests**

Cover:
- lowest projected balance and date
- next paycheck selection
- next bill selection
- “safe to spend” value selection for the current focus window
- narrative/verdict text for safe / caution / pressure states

Run: `npm.cmd run test:unit -- apps/web/src/lib/dashboardPlanner.test.ts`
Expected: FAIL because `dashboardPlanner.ts` does not exist yet.

- [ ] **Step 2: Implement the minimal planner-summary helper**

Implement a focused unit that:
- accepts already-available cash-flow inputs
- derives a dashboard-safe hero summary
- returns explicit text fields for accessibility and hero narrative

Keep it pure. Do not call Supabase in this file.

- [ ] **Step 3: Re-run the planner-summary tests**

Run: `npm.cmd run test:unit -- apps/web/src/lib/dashboardPlanner.test.ts`
Expected: PASS

- [ ] **Step 4: Commit the shared planner-summary extraction**

```bash
git add apps/web/src/lib/dashboardPlanner.ts apps/web/src/lib/dashboardPlanner.test.ts
git commit -m "feat: add dashboard planner summary helpers"
```

### Task 2: Feed the Dashboard Hook with Planner-Ready Data

**Files:**
- Modify: `apps/web/src/hooks/useDashboard.ts`
- Reference: `apps/web/src/hooks/useCashFlow.ts`
- Reference: `apps/web/src/lib/dashboardPlanner.ts`
- Test: `apps/web/src/hooks/useDashboard.data.test.ts` or a new focused dashboard hook/unit test if needed

- [ ] **Step 1: Write the failing hook-level test or extend existing dashboard tests**

Add one failing assertion that the dashboard layer can produce the planner summary shape needed by the hero without breaking existing fields.

Run: `npm.cmd run test:unit -- apps/web/src/hooks/useDashboard.data.test.ts`
Expected: FAIL on missing planner fields or helper integration.

- [ ] **Step 2: Implement the smallest truthful integration**

Preferred approach:
- reuse existing cash-flow ledger inputs or a lightweight subset
- avoid duplicating ledger math inside the Dashboard page
- keep the first pass honest if a metric needs approximation

Do not expand backend scope unless blocked.

- [ ] **Step 3: Re-run the dashboard hook test**

Run: `npm.cmd run test:unit -- apps/web/src/hooks/useDashboard.data.test.ts`
Expected: PASS

- [ ] **Step 4: Commit the dashboard data integration**

```bash
git add apps/web/src/hooks/useDashboard.ts apps/web/src/hooks/useDashboard.data.test.ts
git commit -m "feat: expose dashboard planner summary data"
```

### Task 3: Build the New Planner Hero and Recompose the Top of Dashboard

**Files:**
- Create: `apps/web/src/components/dashboard/DashboardPlannerHero.tsx`
- Test: `apps/web/src/components/dashboard/DashboardPlannerHero.test.tsx`
- Modify: `apps/web/src/pages/Dashboard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardHeader.tsx`

- [ ] **Step 1: Write the failing planner-hero component test**

Test for:
- dominant headline metric
- planner narrative text
- next paycheck / bills due / safe-to-spend support metrics
- semantic summary text existing outside the visual strip
- CTA into Cash Flow

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardPlannerHero.test.tsx`
Expected: FAIL because the component does not exist yet.

- [ ] **Step 2: Implement the new `DashboardPlannerHero`**

Requirements:
- dominant top hero
- Hero Ledger layout
- narrative plus compact visual support
- semantic text equivalent for non-visual users
- no hard-coded promotional copy

- [ ] **Step 3: Slim down `DashboardHeader`**

Requirements:
- keep actions and live status/error handling
- remove passive branding/status-chip clutter
- make context and actions primary

- [ ] **Step 4: Recompose `Dashboard.tsx` so the hero leads the page**

Requirements:
- hero first
- supporting planning panels second
- current equal-weight KPI wall no longer dictates the top hierarchy

- [ ] **Step 5: Run the hero test**

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardPlannerHero.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the top-section redesign**

```bash
git add apps/web/src/components/dashboard/DashboardPlannerHero.tsx apps/web/src/components/dashboard/DashboardPlannerHero.test.tsx apps/web/src/components/dashboard/DashboardHeader.tsx apps/web/src/pages/Dashboard.tsx
git commit -m "feat: redesign dashboard top section as planner hero"
```

## Chunk 2: Supporting Panels + Accessible Trend

### Task 4: Replace the Equal-Weight KPI Wall with Quieter Planning Support

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardStatsGrid.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardAutopilotMetricsCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardOwnerResponsibilityCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardAttentionCard.tsx`

- [ ] **Step 1: Write or extend a failing structural test for the new support hierarchy**

Add a focused test that the supporting dashboard panels no longer present as a flat four-card KPI wall and that autopilot/owner/attention remain secondary to the hero.

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardStatsGrid.test.tsx`
Expected: FAIL because the new structure/test does not exist yet.

- [ ] **Step 2: Simplify `DashboardStatsGrid`**

Requirements:
- fewer same-weight cards
- more purposeful grouping
- anomaly and renewal content framed as planning support / exceptions

- [ ] **Step 3: Quiet the autopilot and attention panels**

Requirements:
- calmer visual language
- better triage wording
- less tint-heavy styling

- [ ] **Step 4: Reframe owner responsibility as a concise monthly contribution panel**

Requirements:
- maintain data
- reduce visual heaviness
- preserve scanability

- [ ] **Step 5: Re-run the structural test**

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardStatsGrid.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the supporting-panel redesign**

```bash
git add apps/web/src/components/dashboard/DashboardStatsGrid.tsx apps/web/src/components/dashboard/DashboardAutopilotMetricsCard.tsx apps/web/src/components/dashboard/DashboardOwnerResponsibilityCard.tsx apps/web/src/components/dashboard/DashboardAttentionCard.tsx apps/web/src/components/dashboard/DashboardStatsGrid.test.tsx
git commit -m "feat: redesign dashboard supporting planning panels"
```

### Task 5: Make Trend and “What Changed” Accessible and More Useful

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardMonthlyTrendCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardRecentTransactionsCard.tsx`

- [ ] **Step 1: Write the failing test for the accessible trend summary**

Test for:
- semantic textual/table/list summary existing alongside the visual trend
- non-color-only net indication
- preserved link into transaction history

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardMonthlyTrendCard.test.tsx`
Expected: FAIL because the accessible summary/test does not exist yet.

- [ ] **Step 2: Add the semantic trend summary**

Requirements:
- screen-reader-meaningful monthly information
- no reliance on `title` attributes as the only fallback
- preserve the visual chart for sighted users

- [ ] **Step 3: Tighten `DashboardRecentTransactionsCard` into a “what changed” panel**

Requirements:
- more meaningful activity framing
- less repetitive list treatment
- maintain direct route into Transactions

- [ ] **Step 4: Re-run the trend test**

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardMonthlyTrendCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the trend/recent-activity improvements**

```bash
git add apps/web/src/components/dashboard/DashboardMonthlyTrendCard.tsx apps/web/src/components/dashboard/DashboardRecentTransactionsCard.tsx apps/web/src/components/dashboard/DashboardMonthlyTrendCard.test.tsx
git commit -m "feat: make dashboard trend and recent activity more accessible"
```

## Chunk 3: Semantic Status, Utility Rail, and Workflow Deep Links

### Task 6: Introduce Shared Semantic Status Styling

**Files:**
- Create: `apps/web/src/components/dashboard/dashboardStatus.ts`
- Test: `apps/web/src/components/dashboard/dashboardStatus.test.ts`
- Modify: `apps/web/src/components/dashboard/DashboardAutopilotMetricsCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardSystemHealthCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardRecentTransactionsCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardStatsGrid.tsx`

- [ ] **Step 1: Write the failing status-tone tests**

Test for:
- shared semantic mapping for success/warning/danger/neutral
- text/icon support not only color styling

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/dashboardStatus.test.ts`
Expected: FAIL because the shared status helper does not exist yet.

- [ ] **Step 2: Implement the shared status helper**

Requirements:
- centralize dashboard-specific semantic tone classes/labels
- reduce repeated emerald/rose/amber class strings

- [ ] **Step 3: Replace direct hard-coded semantic styling in the affected cards**

Requirements:
- keep visual meaning
- improve theme consistency
- avoid regressions in utility cards

- [ ] **Step 4: Re-run the status tests**

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/dashboardStatus.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the semantic-status cleanup**

```bash
git add apps/web/src/components/dashboard/dashboardStatus.ts apps/web/src/components/dashboard/dashboardStatus.test.ts apps/web/src/components/dashboard/DashboardAutopilotMetricsCard.tsx apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx apps/web/src/components/dashboard/DashboardSystemHealthCard.tsx apps/web/src/components/dashboard/DashboardRecentTransactionsCard.tsx apps/web/src/components/dashboard/DashboardStatsGrid.tsx
git commit -m "refactor: normalize dashboard semantic status styling"
```

### Task 7: Harden the Utility Rail and Deep-Link Workflow Actions

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardSystemHealthCard.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardStatsGrid.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardAttentionCard.tsx`
- Modify: `apps/web/src/pages/Dashboard.tsx`

- [ ] **Step 1: Write the failing utility-rail resilience/deep-link test**

Add a focused test for:
- metadata rows stacking instead of relying on `justify-between`
- dashboard CTA targets including specific downstream destinations where possible

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardUtilityRail.test.tsx`
Expected: FAIL because the new assertions/test file do not exist yet.

- [ ] **Step 2: Refactor freshness and health rows for zoom resilience**

Requirements:
- stack or wrap earlier
- support long names, dates, and badges
- remain readable in the sidebar rail

- [ ] **Step 3: Deep-link dashboard CTAs into task-specific destinations**

Examples:
- anomalies into filtered Transactions state if feasible
- renewals into Recurring with the relevant review context
- attention items already deep-linked should stay precise

- [ ] **Step 4: Re-run the utility-rail/deep-link test**

Run: `npm.cmd run test:unit -- apps/web/src/components/dashboard/DashboardUtilityRail.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the utility rail and deep-link pass**

```bash
git add apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx apps/web/src/components/dashboard/DashboardSystemHealthCard.tsx apps/web/src/components/dashboard/DashboardStatsGrid.tsx apps/web/src/components/dashboard/DashboardAttentionCard.tsx apps/web/src/pages/Dashboard.tsx apps/web/src/components/dashboard/DashboardUtilityRail.test.tsx
git commit -m "feat: harden dashboard utility rail and deep links"
```

### Task 8: Run Full Verification and Browser QA

**Files:**
- Modify as needed from previous tasks only

- [ ] **Step 1: Run targeted unit tests for the new dashboard files**

Run:

```bash
npm.cmd run test:unit -- apps/web/src/lib/dashboardPlanner.test.ts apps/web/src/components/dashboard/DashboardPlannerHero.test.tsx apps/web/src/components/dashboard/dashboardStatus.test.ts apps/web/src/components/dashboard/DashboardMonthlyTrendCard.test.tsx apps/web/src/components/dashboard/DashboardStatsGrid.test.tsx apps/web/src/components/dashboard/DashboardUtilityRail.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the web lint check**

Run: `npm.cmd run lint --workspace web`
Expected: PASS

- [ ] **Step 3: Run the web production build**

Run: `npm.cmd run build --workspace web`
Expected: PASS

- [ ] **Step 4: Do real browser QA on the authenticated dashboard**

Check:
- hero hierarchy is dominant
- top section feels like a planning desk
- trend has visible and non-visual summary support
- utility rail stacks cleanly
- CTAs land in useful downstream destinations
- no obvious overflow or contrast regression

- [ ] **Step 5: Commit the final dashboard redesign**

```bash
git add apps/web/src/pages/Dashboard.tsx apps/web/src/components/dashboard apps/web/src/lib/dashboardPlanner.ts apps/web/src/lib/dashboardPlanner.test.ts
git commit -m "feat: redesign dashboard as family planner"
```
