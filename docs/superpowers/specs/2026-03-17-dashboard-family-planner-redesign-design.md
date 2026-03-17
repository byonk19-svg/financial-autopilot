# Dashboard Family Planner Redesign

Date: 2026-03-17

## Summary

Redesign the Dashboard from a balanced KPI grid into a calmer planning desk that helps the household answer one question immediately: "What does checking look like for the rest of the month?"

The new dashboard should lead with a dominant cash-flow runway hero, demote generic system/status content, tighten accessibility, and reduce the current equal-weight card clutter. The experience should feel warmer and more deliberate than the current operations-style layout while still supporting quick triage into Transactions, Cash Flow, Alerts, and Recurring.

## Goals

- Make checking-account planning the first thing users see on Dashboard.
- Prioritize projected runway and upcoming bills over generic KPI summaries.
- Reduce visual noise from too many same-weight cards and tinted panels.
- Fix the key audit issues:
  - Monthly trend is too visual-only.
  - Status meaning relies too much on color.
  - Freshness and health metadata rows are fragile under zoom and long content.
  - Header copy and passive status chips waste prime space.
  - Dashboard CTAs are not deep-linked enough for fast triage.
- Preserve the existing data model where possible for the first pass.

## Non-Goals

- Do not redesign the entire app shell or sidebar.
- Do not block the redesign on new complex backend forecasting logic.
- Do not turn Dashboard into a fully different information architecture than the rest of the app.
- Do not remove Data Freshness or System Health from the product; only demote and restyle them.

## Chosen Direction

The chosen visual/product direction is:

- Family Planner visual language
- Cash flow and upcoming bills dominate the top of the page
- Hero Ledger top layout

This means the dashboard should feel more like a household planning desk than an analytical control wall.

## Information Hierarchy

### 1. Top Hero: Monthly Runway

The first section becomes a single dominant planning card focused on checking-account runway.

Primary headline:

- Projected lowest checking balance this month

Supporting metrics:

- Next paycheck date and amount
- Bills due in the next 14 days
- Safe-to-spend until next paycheck
- Current checking balance
- Month cash flow so far

Planning narrative:

- The hero should not be a plain stat tile. It needs a concise text interpretation such as:
  - "Lowest projected balance hits on Mar 24."
  - "Next paycheck lands before the tightest point."
  - "Bills briefly outpace inflow next week."

Visual support:

- Include a compact runway strip or simple timeline that shows pressure points through the month.
- The visual must be supported by semantic text, not color/shape alone.

Primary CTA:

- Deep-link into Cash Flow with the current month context.

### 2. Second Row: Supporting Planning Panels

These panels remain important but should be visually quieter than the hero:

- Owner responsibility
  - Reframed as "who is carrying what this month"
- Autopilot coverage
  - Reframed as automation confidence and cleanup burden

These cards should be smaller, cleaner, and less tinted than the current dashboard.

### 3. Third Row: What Changed

This row should emphasize recent movement and exceptions:

- Recent activity
  - More meaningful and grouped, less repetitive list styling
- Unusual charges / anomalies
  - Presented as exceptions worth reviewing, not as just another alert-colored card

Both panels should feel like "what changed recently" rather than generic metrics.

### 4. Lower Sections: Secondary Modules

The remaining dashboard modules stay available but move lower in the hierarchy:

- Spend by category
- Upcoming renewals
- Shift week
- Savings buckets
- Insight feed
- Data freshness
- System health

These should feel secondary and utility-oriented rather than first-scan content.

## Content Changes

### Header

The current Dashboard header should be simplified substantially.

Keep:

- Page title/context
- Primary sync action
- Repair action if still needed
- Error/reconnect messaging

Remove or demote:

- Generic positioning copy like "command center"
- Passive pills such as "Connected data" and "Weekly insights enabled"

The header should become action- and context-oriented, not promotional.

### KPI Grid

The current equal-weight KPI card grid should no longer be the main structural backbone.

Changes:

- Reduce the number of same-weight cards
- Merge or demote cards where possible
- Use fewer tinted cards and less repetitive visual treatment
- Emphasize planning and triage over "four boxes of numbers"

## Accessibility Requirements

### Runway / Trend Visuals

- Any chart-like or bar-like visualization must have a semantic text equivalent.
- The monthly trend section should provide a non-visual summary, table, or list version so screen-reader and low-vision users receive the same underlying information.
- Do not rely on tooltips or `title` attributes as the only accessible explanation.

### Color Semantics

- Success/warning/danger meaning must not rely only on green/amber/red.
- Pair color with text and, where useful, iconography or explicit status wording.
- Replace scattered hard-coded semantic colors with shared semantic styles or token-driven badge variants.

### Metadata Rows

- Data Freshness and System Health rows must stack cleanly under zoom and narrower widths.
- Long timestamps, job names, institutions, and badges must not depend on `justify-between` staying roomy.

### Interaction

- Focus styles must stay obvious on all links and controls.
- CTAs from Dashboard should deep-link users into the correct downstream context whenever possible.

## Responsive Behavior

### Desktop

- Dominant runway hero spans the top.
- Supporting modules arrange beneath it in a calmer, clearly tiered layout.
- Sidebar utility rail can remain for health/freshness if it still supports scanability.

### Tablet

- Hero remains visually dominant.
- Supporting modules collapse into clean two-column groupings.
- Avoid brittle horizontal metadata rows.

### Mobile

- Mobile is not the immediate design target, but the hierarchy must degrade naturally.
- The hero should still read as the top planning block.
- Avoid returning to dense equal-weight card stacking.

## Data and Backend Constraints

### First Pass Constraint

The redesign should reuse existing data where possible.

Allowed:

- Reformatting and reprioritizing already available dashboard data
- Deriving lightweight helper values in the client if straightforward

Avoid for first pass:

- Complex new forecasting backend work
- Large schema changes
- Blocking the redesign on perfect "safe to spend" logic if the current data only supports a simpler approximation

If a desired metric is not fully supportable from existing data, use the closest honest planning-friendly version in pass one and leave room for a follow-up.

## Implementation Boundaries

Files likely affected:

- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/components/dashboard/DashboardHeader.tsx`
- `apps/web/src/components/dashboard/DashboardStatsGrid.tsx`
- `apps/web/src/components/dashboard/DashboardMonthlyTrendCard.tsx`
- `apps/web/src/components/dashboard/DashboardRecentTransactionsCard.tsx`
- `apps/web/src/components/dashboard/DashboardAttentionCard.tsx`
- `apps/web/src/components/dashboard/DashboardAutopilotMetricsCard.tsx`
- `apps/web/src/components/dashboard/DashboardOwnerResponsibilityCard.tsx`
- `apps/web/src/components/dashboard/DashboardDataFreshnessCard.tsx`
- `apps/web/src/components/dashboard/DashboardSystemHealthCard.tsx`

Potential supporting work:

- Introduce a shared semantic status style pattern for success/warning/danger chips and badges.
- Add helper presentation components if the current dashboard files become too mixed in responsibility.

## Verification

### Functional

- Dashboard still loads for authenticated users.
- Sync, repair, reconnect, and deep-link actions still work.
- Existing lazy/deferred sections still behave correctly.

### Accessibility

- Runway/trend visuals expose equivalent text information.
- Keyboard focus remains intact across the redesigned layout.
- Zoom/text scaling does not collapse metadata sections.
- Status meaning remains understandable without color perception.

### Quality

- Dashboard hierarchy clearly emphasizes cash-flow planning first.
- Header no longer wastes prime space on passive branding/status copy.
- The page feels meaningfully different from the previous equal-weight KPI wall.

## Risks

- Over-designing the hero without enough truthful planning data could make it feel more precise than it is.
- Keeping too many legacy cards unchanged would dilute the redesign.
- A heavy visual rewrite without component boundary cleanup could make Dashboard harder to maintain.

## Recommendation

Implement this redesign in one focused dashboard pass with the following execution order:

1. Rebuild the top hero and header hierarchy.
2. Restructure the second and third rows around planning and "what changed."
3. Make the trend/runway content accessible and non-color-dependent.
4. Demote and harden the utility/health sections.
5. Deep-link dashboard CTAs into more task-specific destinations.
