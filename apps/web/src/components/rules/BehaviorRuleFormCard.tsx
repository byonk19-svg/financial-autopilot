import type { FormEvent } from 'react'
import { RULE_PRESETS, type RuleForm } from '@/hooks/useRules'
import type { SubscriptionCadence, SubscriptionClassification } from '@/lib/types'
import { BehaviorPresetIcon } from '@/components/rules/RuleIcons'

type AccountOption = { id: string; name: string; institution: string | null }

type BehaviorRuleFormCardProps = {
  form: RuleForm
  accounts: AccountOption[]
  saving: boolean
  showAdvanced: boolean
  onSetForm: (updater: (current: RuleForm) => RuleForm) => void
  onToggleAdvanced: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function BehaviorRuleFormCard({
  form,
  accounts,
  saving,
  showAdvanced,
  onSetForm,
  onToggleAdvanced,
  onSubmit,
}: BehaviorRuleFormCardProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Quick Behavior Rule</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {RULE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              onSetForm((current) => ({
                ...current,
                name: preset.name,
                pattern: preset.pattern,
                classification: preset.classification,
                forceMerchant: preset.forceMerchant ?? '',
              }))
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors-fast hover:bg-accent"
          >
            <BehaviorPresetIcon />
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        <input value={form.name} onChange={(e) => onSetForm((c) => ({ ...c, name: e.target.value }))} placeholder="Rule name" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
        <input value={form.pattern} onChange={(e) => onSetForm((c) => ({ ...c, pattern: e.target.value }))} placeholder='Match text (example: "netflix|hulu|spotify")' className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
        <select value={form.classification} onChange={(e) => onSetForm((c) => ({ ...c, classification: e.target.value as SubscriptionClassification }))} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2">
          <option value="needs_review">Set behavior: Needs review</option>
          <option value="subscription">Set behavior: Subscription</option>
          <option value="bill_loan">Set behavior: Bill/Loan</option>
          <option value="transfer">Set behavior: Transfer</option>
          <option value="ignore">Set behavior: Ignore</option>
        </select>
        <input value={form.forceMerchant} onChange={(e) => onSetForm((c) => ({ ...c, forceMerchant: e.target.value }))} placeholder='Rename merchant to (optional, example: "COMCAST")' className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
        <button type="button" onClick={onToggleAdvanced} className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
          {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
        </button>
        {showAdvanced && (
          <div className="space-y-3 rounded-lg border border bg-muted/50 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select value={form.matchType} onChange={(e) => onSetForm((c) => ({ ...c, matchType: e.target.value as 'contains' | 'equals' | 'regex' }))} className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2">
                <option value="contains">Match type: contains</option>
                <option value="equals">Match type: equals</option>
                <option value="regex">Match type: regex</option>
              </select>
              <select value={form.accountId} onChange={(e) => onSetForm((c) => ({ ...c, accountId: e.target.value }))} className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2">
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.institution ? ` (${account.institution})` : ''}
                  </option>
                ))}
              </select>
              <select value={form.cadence} onChange={(e) => onSetForm((c) => ({ ...c, cadence: e.target.value as '' | SubscriptionCadence }))} className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2">
                <option value="">Any cadence</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="unknown">Unknown</option>
              </select>
              <input type="number" value={form.priority} onChange={(e) => onSetForm((c) => ({ ...c, priority: e.target.value }))} placeholder="Priority (lower runs first)" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" step="0.01" value={form.minAmount} onChange={(e) => onSetForm((c) => ({ ...c, minAmount: e.target.value }))} placeholder="Min amount" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
              <input type="number" step="0.01" value={form.maxAmount} onChange={(e) => onSetForm((c) => ({ ...c, maxAmount: e.target.value }))} placeholder="Max amount" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
              <input type="number" step="0.01" value={form.targetAmount} onChange={(e) => onSetForm((c) => ({ ...c, targetAmount: e.target.value }))} placeholder="Target amount" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
              <input type="number" step="0.01" value={form.tolerancePct} onChange={(e) => onSetForm((c) => ({ ...c, tolerancePct: e.target.value }))} placeholder="Tolerance (0 to 1)" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
            </div>
            <textarea value={form.explanation} onChange={(e) => onSetForm((c) => ({ ...c, explanation: e.target.value }))} placeholder="Explanation (optional)" rows={2} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2" />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.isActive} onChange={(e) => onSetForm((c) => ({ ...c, isActive: e.target.checked }))} />
              Active
            </label>
          </div>
        )}
      </div>
      <button type="submit" disabled={saving} className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
        Add behavior rule
      </button>
    </form>
  )
}
