# Financial Autopilot

## What This Is

Financial Autopilot is a personal finance web app that syncs bank and card transactions, classifies spending, and highlights recurring charges and billing risks. It is designed for household budgeting with an emphasis on recurring/subscription visibility and fast manual correction when classifications are wrong.

## Core Value

Users can trust that recurring charges and subscriptions are detected clearly and acted on quickly.

## Requirements

### Validated

- ✅ Users can view synced transactions and recurring charges.
- ✅ Users can trigger sync and analysis flows from the UI.

### Active

- [ ] GSD planning baseline exists and is auditable.
- [ ] Milestone requirements and phase traceability are explicit.
- [ ] Gap-closure phases can be planned/executed with standard GSD commands.

### Out of Scope

- Building new business features in this step — this step only establishes planning and audit structure.

## Context

- Repo uses React + Playwright + Supabase edge functions.
- Team is actively improving recurring/subscription quality and UX.
- Existing `.planning` state had todo + audit artifacts but no roadmap/requirements/phase structure.

## Constraints

- **Continuity**: Preserve existing product code progress — planning bootstrap must not block feature work.
- **Compatibility**: Follow GSD file conventions so existing commands (`$gsd-plan-phase`, `$gsd-audit-milestone`) work.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bootstrap planning with a focused Phase 1 | Audit was blocked by missing planning files | — Pending |

---
*Last updated: 2026-03-07 after milestone audit gap closure bootstrap*
