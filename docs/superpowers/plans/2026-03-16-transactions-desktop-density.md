# Transactions Desktop Density Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop/tablet Transactions table denser and more polished while keeping inline details and all existing behavior.

**Architecture:** Keep the current Transactions table component structure, add one small component-tree regression test for the denser desktop structure, then tighten spacing and visual hierarchy directly in the desktop table and expanded detail row. Preserve the separate mobile card layout from the previous pass.

**Tech Stack:** React 18, TypeScript, Vitest, Vite

---

## Chunk 1: Regression Test

### Task 1: Add a failing test for desktop table structure

**Files:**
- Create: `apps/web/src/components/transactions/TransactionsResultsTable.test.tsx`
- Test: `apps/web/src/components/transactions/TransactionsResultsTable.test.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `npm.cmd run test:unit -- apps/web/src/components/transactions/TransactionsResultsTable.test.tsx` and verify it fails**
- [ ] **Step 3: Implement the minimal desktop density changes**
- [ ] **Step 4: Re-run the same test and verify it passes**

## Chunk 2: Desktop Density Pass

### Task 2: Tighten desktop table hierarchy

**Files:**
- Modify: `apps/web/src/components/transactions/TransactionsResultsTable.tsx`

- [ ] **Step 1: Make the desktop table header sticky inside the results surface**
- [ ] **Step 2: Reduce desktop row/header padding and calm non-primary cell styling**
- [ ] **Step 3: Push the description column to wider desktop breakpoints**
- [ ] **Step 4: Compact the category and details controls on desktop**
- [ ] **Step 5: Quiet the expanded inline detail panel so it feels secondary**

## Chunk 3: Verification

### Task 3: Verify the pass

**Files:**
- Test: `apps/web/src/components/transactions/TransactionsResultsTable.test.tsx`

- [ ] **Step 1: Run `npm.cmd run test:unit -- apps/web/src/components/transactions/TransactionsResultsTable.test.tsx`**
- [ ] **Step 2: Run `npm.cmd run lint --workspace web`**
- [ ] **Step 3: Run `npm.cmd run build --workspace web`**
