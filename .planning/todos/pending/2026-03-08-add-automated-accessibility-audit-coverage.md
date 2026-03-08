---
created: 2026-03-08T01:12:58.333Z
title: Add automated accessibility audit coverage
area: testing
files:
  - apps/web/src/App.tsx
  - apps/web/src/index.css
  - apps/web/src/components/subscriptions/SubscriptionSection.tsx
  - tests/e2e/authenticated-flow.spec.ts
  - playwright.config.ts
---

## Problem

Accessibility improvements were made manually, but there is no automated a11y gate in the test workflow. This makes it easy for regressions in focus order, aria labels, contrast, or keyboard behavior to ship unnoticed.

## Solution

Add automated accessibility checks (axe and/or Lighthouse accessibility assertions) into the existing Playwright flow and CI pipeline. Fail CI when baseline WCAG AA checks regress and document a repeatable local command for developers.
