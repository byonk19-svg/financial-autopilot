import { classificationLabel, formatTime, friendlyRuleSummary, type TransactionRuleRow } from '@/hooks/useRules'

type BehaviorRulesListProps = {
  rules: TransactionRuleRow[]
  fetching: boolean
  saving: boolean
  onToggleRule: (rule: TransactionRuleRow) => Promise<void>
  onDeleteRule: (rule: TransactionRuleRow) => Promise<void>
}

export function BehaviorRulesList({
  rules,
  fetching,
  saving,
  onToggleRule,
  onDeleteRule,
}: BehaviorRulesListProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Saved Behavior Rules</h2>
      {fetching ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
      ) : rules.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No behavior rules yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rules.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm text-foreground">{friendlyRuleSummary(row)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Priority {row.priority} • {row.cadence ?? 'Any cadence'} • Updated {formatTime(row.updated_at)}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Advanced details</summary>
                <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  <p>Amount range: {row.min_amount ?? 'Any'} to {row.max_amount ?? 'Any'}</p>
                  <p>Target / tolerance: {row.target_amount ?? 'None'} / {row.amount_tolerance_pct ?? 'None'}</p>
                  <p>Classification: {classificationLabel(row.set_pattern_classification)}</p>
                  {row.explanation && <p>Why: {row.explanation}</p>}
                </div>
              </details>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onToggleRule(row)}
                  disabled={saving}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {row.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteRule(row)}
                  disabled={saving}
                  className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors-fast hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
