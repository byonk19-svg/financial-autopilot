# App Usability Audit + Improvement Plan

## Audit Findings

### 1. Dashboard: Information-dense, zero actionability
The dashboard surfaces KPIs, insights, system health, shifts, savings, and renewals — but never
answers the most important question: **"What do I actually need to do right now?"**

There is no surface that says "You have 12 uncategorized transactions" or "3 subscriptions need
review." The user has to open each page independently to find out if anything needs attention.
The System Health card (a technical/ops view) sits visually alongside insights and has equal weight
to things users actually care about.

### 2. Navigation: 11 items, unclear labels
Current nav:
- Main: Dashboard, Overview, Transactions, Cash Flow, Shift Log
- Automation: Subscriptions, Alerts
- Config: Rules, Class Rules, Settings, Connect

Problems:
- "Class Rules" is internal jargon — it means nothing to a user
- "Rules" and "Class Rules" both sound like rule management but are distinct systems
- "Connect" is a one-time bank setup page that takes up a permanent nav slot
- "Feed" page exists in the app but is not in the nav at all
- No indication of what each section/group is for

### 3. No daily workflow signal
After syncing, there is no guidance on what to act on. The user must know to:
1. Go to Transactions and categorize things
2. Go to Subscriptions and review detections
3. Go to Alerts and address anomalies

None of this is surfaced or prompted. The app feels complete but passive.

### 4. Dashboard section order is wrong
Current order: Header → Stats → Insights + System Health → Shifts → Savings → Renewals

System Health (a technical ops view) is given equal prominence to Insights and sits above
Shifts and Savings, which are more directly useful for daily understanding.

### 5. Pages lack orientation text
Pages like Overview, Rules, Classification Rules, and Cash Flow have no subtitle or description
explaining what the page is for and when you'd use it. A user who lands on "Classification Rules"
has no idea if it's relevant to them or what to do there.

---

## Implementation Plan (Prioritized by Impact)

### Priority 1: Dashboard "Needs Attention" card
**What:** Add a card at the top of the Dashboard that queries for pending actions and surfaces
them as tappable links. Show a clean "all clear" state when nothing needs attention.

**Actions to surface:**
- Uncategorized transactions (query `transactions` where `category_id IS NULL` and `type != 'transfer'`)
- Subscriptions in "needs review" state (query `recurring_charges` where `classification = 'review'`)
- Unread alerts (query `autopilot_alerts` where `dismissed_at IS NULL`)
- Accounts without an owner assigned (query `accounts` where `owner IS NULL`)

**Where:** New `DashboardAttentionCard` component, inserted between the Header and StatsGrid in `Dashboard.tsx`.

**Files to change:**
- `apps/web/src/components/dashboard/DashboardAttentionCard.tsx` (new)
- `apps/web/src/hooks/useDashboard.ts` — add `attentionItems` to the hook
- `apps/web/src/pages/Dashboard.tsx` — insert the card

---

### Priority 2: Navigation cleanup
**What:** Rename confusing items, remove "Connect" from the main nav (show it only in Settings or
as a small indicator if disconnected), and clarify the Rules section.

**Changes:**
- Rename "Class Rules" → "Auto-Rules"
- Rename "Rules" → "Manual Rules"
- Remove "Connect" from the nav group entirely; add a "Reconnect bank" link inside Settings page
  and surface a reconnect banner on Dashboard if `syncNeedsReconnect` is true (this already exists
  in the sync error handling — just remove from nav)
- Optionally add "Feed" to the Automation nav group

**Files to change:**
- `apps/web/src/App.tsx` — update nav items array

---

### Priority 3: Dashboard section reorder
**What:** Move actionable content above informational/ops content.

**New order:**
1. Header (sync button, status)
2. **Needs Attention card** (new — Priority 1)
3. Stats grid (KPIs)
4. Shifts + Savings + Renewals (daily-relevant)
5. Insight Feed + System Health (weekly/ops — less urgent)

**Files to change:**
- `apps/web/src/pages/Dashboard.tsx` — reorder JSX sections

---

### Priority 4: Page orientation subtitles
**What:** Add a one-line subtitle under each page heading so users understand the purpose and
context of each page on first glance.

**Pages + proposed subtitles:**
- Overview: "Account balances and ownership assignment"
- Transactions: "Browse, search, and categorize all transactions"
- Cash Flow: "Project your monthly checking balance with bills and income"
- Shift Log: "Track hours and gross pay by employer"
- Subscriptions: "Recurring charges detected from your transaction history"
- Alerts: "Unusual activity and anomalies flagged by the system"
- Rules (Manual Rules): "Alias and behavior rules applied when you run analysis"
- Auto-Rules: "Categorization rules applied automatically at sync time"
- Settings: "Account preferences and data management"

**Files to change:** Each respective page file's header section.

---

## What is NOT in this plan
- Database migrations (not needed for these changes)
- Backend changes (all queries are existing endpoints)
- Behavior changes to sync, rules, or categorization logic
- Redesigning any existing pages beyond adding subtitles/reordering sections
