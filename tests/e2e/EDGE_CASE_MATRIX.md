# Edge Case Test Matrix

## Top 5 high-risk cases (implemented)

1. Pending visibility default:
   - Risk: pending charges pollute transaction review.
   - Automated test: `transactions hide pending by default and remove filter when toggled on`.
   - Coverage: checks API query includes `is_pending=eq.false` by default and removes it when `Show pending` is enabled.

2. Per-account recurring splits:
   - Risk: multiple cards collapse into one recurring item.
   - Automated test: `split recurring merchants render as separate rows`.
   - Coverage: verifies separate Netflix rows (`Netflix - Chase`, `Netflix - Citi`, `Netflix - Wayfair`).

3. Friendly merchant search on split labels:
   - Risk: users cannot find split entries by human-readable label.
   - Automated test: `friendly search matches split recurring merchant labels`.
   - Coverage: verifies search for `Netflix - Citi` isolates the correct split row.

4. Filtered no-match recovery:
   - Risk: empty states are ambiguous and users get stuck.
   - Automated test: `no-match state explains filters and recovers with clear filters`.
   - Coverage: verifies `No matches` state appears and `Clear filters` restores rows.

5. Analysis action in-flight feedback:
   - Risk: users re-click actions and trigger duplicate runs.
   - Automated test: `rules run button reflects in-flight analysis state`.
   - Coverage: verifies button changes to `Running...`, is disabled in-flight, and shows completion state.

## Remaining high-value edge cases (next)

1. Partial sync failure across multi-account connection (some accounts fail, others succeed).
2. Stale pending cleanup false positives when posted amount/date drift outside thresholds.
3. Midnight timezone boundary drift in dashboard daily aggregation.
4. Cadence detection around month-end (28/29/30/31 day variability).
5. Rule priority collisions where multiple active rules match same transaction.
