import type { AliasRow } from '@/hooks/useRules'
import { formatTime } from '@/hooks/useRules'

type AliasRulesListProps = {
  aliases: AliasRow[]
  fetching: boolean
  saving: boolean
  onToggleAlias: (alias: AliasRow) => Promise<void>
  onDeleteAlias: (alias: AliasRow) => Promise<void>
}

export function AliasRulesList({
  aliases,
  fetching,
  saving,
  onToggleAlias,
  onDeleteAlias,
}: AliasRulesListProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Saved Alias Rules</h2>
      {fetching ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
      ) : aliases.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No alias rules yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {aliases.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm text-foreground">
                If transaction text <strong>{row.match_type}</strong> "<strong>{row.pattern}</strong>", rename merchant to{' '}
                <strong>{row.normalized}</strong>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Priority {row.priority} • Updated {formatTime(row.updated_at)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onToggleAlias(row)}
                  disabled={saving}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {row.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteAlias(row)}
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
