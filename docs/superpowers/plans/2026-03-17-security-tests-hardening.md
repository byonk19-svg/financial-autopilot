# Security And Test Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the `seed_user_categories` privilege-escalation hole, stop persisting the SimpleFIN setup token in browser storage, and add regression tests around the auth and transaction mutation paths that currently lack coverage.

**Architecture:** Use a new Supabase migration to harden the RPC without rewriting historical migrations, mirror the existing SQL smoke-test pattern for a regression check, and add focused Vitest coverage for the frontend auth wrapper and follow-up mutation helpers. Keep the code changes local and low-risk, with one small dashboard query cleanup folded in because it touches the same review batch.

**Tech Stack:** Supabase SQL migrations, React 18 + TypeScript, Vitest

---

## Chunk 1: Security Fixes

### Task 1: Add a failing SQL regression smoke test for `seed_user_categories`

**Files:**
- Create: `supabase/tests/seed_user_categories_smoke.sql`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Confirm the script demonstrates the current unsafe override path**
- [ ] **Step 3: Keep the script transaction-wrapped and rollback-safe**

### Task 2: Harden `seed_user_categories` with a new migration

**Files:**
- Create: `supabase/migrations/0060_seed_user_categories_auth_fix.sql`

- [ ] **Step 1: Write the migration so the function always uses `auth.uid()`**
- [ ] **Step 2: Preserve current behavior for normal authenticated callers**
- [ ] **Step 3: Re-grant execute only after the safe function body is in place**

### Task 3: Remove setup-token persistence from the connect page

**Files:**
- Modify: `apps/web/src/pages/Connect.tsx`

- [ ] **Step 1: Write the failing frontend regression test that expects no storage persistence**
- [ ] **Step 2: Remove `sessionStorage` reads/writes while keeping the existing submit flow**
- [ ] **Step 3: Re-run the targeted test to verify green**

## Chunk 2: Frontend Regression Coverage

### Task 4: Add auth-wrapper tests for edge-function calls

**Files:**
- Create: `apps/web/src/lib/fetchWithAuth.test.ts`
- Modify: `apps/web/src/lib/fetchWithAuth.ts` only if testability requires a minimal safe export change

- [ ] **Step 1: Write failing tests for header injection, 401 retry, and expired-session sign-out**
- [ ] **Step 2: Implement only the minimal changes needed for deterministic testing**
- [ ] **Step 3: Re-run the targeted test file until green**

### Task 5: Add transaction follow-up mutation tests

**Files:**
- Create: `apps/web/src/hooks/useTransactions.followUp.test.ts`
- Modify: `apps/web/src/hooks/useTransactions.followUp.ts` only if testability requires a minimal safe export change

- [ ] **Step 1: Write failing tests for apply-and-rule warnings, hide-everywhere, and background analysis trigger behavior**
- [ ] **Step 2: Make the smallest code changes needed to support those tests**
- [ ] **Step 3: Re-run the targeted test file until green**

### Task 6: Cover dashboard snapshot orchestration at the function boundary

**Files:**
- Create: `apps/web/src/hooks/useDashboard.data.test.ts`
- Modify: `apps/web/src/hooks/useDashboard.data.ts` only if testability requires exporting the snapshot loader

- [ ] **Step 1: Write a failing test for partial-success snapshot normalization**
- [ ] **Step 2: Add only the minimum export/test seam needed**
- [ ] **Step 3: Re-run the targeted test file until green**

## Chunk 3: Low-Risk Performance Cleanup

### Task 7: Tighten count-only dashboard queries

**Files:**
- Modify: `apps/web/src/hooks/useDashboard.data.ts`

- [ ] **Step 1: Update count-only `head: true` queries to request only the minimal selected column**
- [ ] **Step 2: Keep all current result handling intact**
- [ ] **Step 3: Re-run the dashboard regression test to guard against behavioral drift**

### Task 8: Verify the batch

**Files:**
- Modify only if verification exposes defects

- [ ] **Step 1: Run targeted unit tests**
- [ ] **Step 2: Run `npm.cmd run lint --workspace web`**
- [ ] **Step 3: Run `npm.cmd run build --workspace web`**
- [ ] **Step 4: Summarize what shipped and what remains for the larger dashboard/search performance pass**
