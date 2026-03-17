# Transactions Follow-Up Banner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the transactions follow-up banner pinned to the viewport so category and hide prompts stay visible without forcing the user to scroll.

**Architecture:** Move the follow-up card into a small shared portal shell that renders to `document.body`, which avoids the transformed page container in the app shell. Reuse that shell for both category and hide follow-up prompts so the behavior and styling stay consistent.

**Tech Stack:** React 18, TypeScript, Vite, Vitest

---

## Chunk 1: Portal Shell

### Task 1: Add a failing portal test

**Files:**
- Create: `apps/web/src/components/transactions/FollowUpBannerShell.test.tsx`
- Test: `apps/web/src/components/transactions/FollowUpBannerShell.test.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the test to verify it fails**
- [ ] **Step 3: Implement the minimal shell component**
- [ ] **Step 4: Re-run the test to verify it passes**

### Task 2: Reuse the shell in both follow-up banners

**Files:**
- Create: `apps/web/src/components/transactions/FollowUpBannerShell.tsx`
- Modify: `apps/web/src/components/transactions/CategoryFollowUpBanner.tsx`
- Modify: `apps/web/src/components/transactions/HideFollowUpBanner.tsx`

- [ ] **Step 1: Move the shared fixed-position container into the shell**
- [ ] **Step 2: Keep category prompt content unchanged inside the new shell**
- [ ] **Step 3: Keep hide prompt content unchanged inside the new shell**
- [ ] **Step 4: Preserve responsive spacing and action layout**

## Chunk 2: Verification

### Task 3: Verify the fix

**Files:**
- Test: `apps/web/src/components/transactions/FollowUpBannerShell.test.tsx`

- [ ] **Step 1: Run `npm.cmd run test:unit -- apps/web/src/components/transactions/FollowUpBannerShell.test.tsx`**
- [ ] **Step 2: Run `npm.cmd run lint --workspace web`**
- [ ] **Step 3: Summarize any remaining manual QA needed in the Transactions flow**
