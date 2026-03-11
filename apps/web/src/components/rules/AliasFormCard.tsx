import { useId, type FormEvent } from 'react'
import { ALIAS_PRESETS, type AliasForm } from '@/hooks/useRules'
import type { AliasRow } from '@/hooks/useRules'
import { AliasPresetIcon } from '@/components/rules/RuleIcons'

type AccountOption = { id: string; name: string; institution: string | null }

type AliasFormCardProps = {
  form: AliasForm
  accounts: AccountOption[]
  saving: boolean
  showAdvanced: boolean
  onSetForm: (updater: (current: AliasForm) => AliasForm) => void
  onToggleAdvanced: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function AliasFormCard({
  form,
  accounts,
  saving,
  showAdvanced,
  onSetForm,
  onToggleAdvanced,
  onSubmit,
}: AliasFormCardProps) {
  const idPrefix = useId()

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Quick Alias (Rename Merchant)</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALIAS_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              onSetForm((current) => ({
                ...current,
                pattern: preset.pattern,
                normalized: preset.normalized,
              }))
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent md:min-h-9 md:px-2.5 md:py-1.5 md:text-xs"
          >
            <AliasPresetIcon />
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        <label htmlFor={`${idPrefix}-pattern`} className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Match text</span>
          <input
            id={`${idPrefix}-pattern`}
            value={form.pattern}
            onChange={(e) => onSetForm((c) => ({ ...c, pattern: e.target.value }))}
            placeholder='Match text (example: "comcast xfinity houston")'
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          />
        </label>
        <label htmlFor={`${idPrefix}-normalized`} className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Rename merchant to</span>
          <input
            id={`${idPrefix}-normalized`}
            value={form.normalized}
            onChange={(e) => onSetForm((c) => ({ ...c, normalized: e.target.value }))}
            placeholder='Rename to (example: "COMCAST")'
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          />
        </label>
        <button type="button" onClick={onToggleAdvanced} className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
          {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
        </button>
        {showAdvanced && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/50 p-3 md:grid-cols-2">
            <label htmlFor={`${idPrefix}-match-type`} className="space-y-1 text-sm">
              <span className="text-muted-foreground">Match type</span>
              <select
                id={`${idPrefix}-match-type`}
                value={form.matchType}
                onChange={(e) => onSetForm((c) => ({ ...c, matchType: e.target.value as AliasRow['match_type'] }))}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="regex">Regex</option>
              </select>
            </label>
            <label htmlFor={`${idPrefix}-account`} className="space-y-1 text-sm">
              <span className="text-muted-foreground">Account scope</span>
              <select
                id={`${idPrefix}-account`}
                value={form.accountId}
                onChange={(e) => onSetForm((c) => ({ ...c, accountId: e.target.value }))}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.institution ? ` (${account.institution})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-priority`} className="space-y-1 text-sm">
              <span className="text-muted-foreground">Priority</span>
              <input
                id={`${idPrefix}-priority`}
                type="number"
                value={form.priority}
                onChange={(e) => onSetForm((c) => ({ ...c, priority: e.target.value }))}
                placeholder="Lower runs first"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.isActive} onChange={(e) => onSetForm((c) => ({ ...c, isActive: e.target.checked }))} />
              Active
            </label>
          </div>
        )}
      </div>
      <button type="submit" disabled={saving} className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
        Add alias
      </button>
    </form>
  )
}
