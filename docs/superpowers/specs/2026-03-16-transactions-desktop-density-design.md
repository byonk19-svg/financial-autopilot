# Transactions Desktop Density Design

## Goal

Make the desktop and tablet Transactions view denser, faster to scan, and less visually heavy while preserving the existing inline workflow for categorization, bulk actions, and row inspection.

## Why This Pass

The current Transactions page works, but the desktop/tablet view still carries too much visual weight in the default state:

- category controls read larger than they need to
- rows spend too much vertical space relative to the information value they provide
- expanded details feel like a second interface layered into the table
- bulk actions become less efficient than they should be for repetitive cleanup work

This pass is about throughput with polish, not a structural rewrite.

## Direction

Keep the inline expandable-row pattern. It already matches the current workflow and avoids introducing a competing side-panel model inside the existing application shell. The work should focus on making the collapsed table state feel denser and more intentional, because that is where most repetitive categorization and review happens.

## Design Decisions

### 1. Dense default table

- Reduce row and header padding on `lg+` screens.
- Make the header sticky inside the results surface so column context stays visible during long review sessions.
- Quiet the table chrome by reducing the visual weight of borders and secondary cells.

### 2. Strong scanning hierarchy

- Merchant remains the primary text anchor.
- Amount uses right alignment and tabular alignment so comparisons are faster.
- Date remains compact and secondary.
- Description stays hidden until wider desktop breakpoints so standard laptop widths prioritize the main decision columns.

### 3. Compact controls

- Category control becomes a smaller inline picker that still truncates safely and remains easy to hit.
- Details toggle becomes a quieter secondary action rather than a full-weight button competing with the category control.
- Bulk actions should stay anchored and visible enough that selecting multiple rows feels efficient instead of disruptive.

### 4. Lighter expanded details

- Expanded details stay inline.
- The open state should read like a subordinate audit strip, not like a second card competing with the table row above it.
- Metadata spacing gets tighter and action controls become more compact and grouped.

## Interaction Rules

- No business-logic changes.
- No change to data flow, hooks, or mutation behavior.
- Existing keyboard and pointer behavior must remain intact.
- Mobile behavior from the previous pass stays as-is unless directly affected by a shared component.

## Verification

- Add or keep a focused component-level regression test that proves the denser desktop structure.
- Re-run lint and production build.
- Perform a browser spot-check at desktop/tablet widths in the Transactions page.
