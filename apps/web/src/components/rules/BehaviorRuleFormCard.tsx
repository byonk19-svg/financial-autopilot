import { useId, type FormEvent } from 'react'
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
  const idPrefix = useId()

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent md:min-h-9 md:px-2.5 md:py-1.5 md:text-xs"
          >
            <BehaviorPresetIcon />
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        <label htmlFor={`${idPrefix}-name`} className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Rule name</span>
          <input
            id={`${idPrefix}-name`}
            value={form.name}
            onChange={(e) => onSetForm((c) => ({ ...c, name: e.target.value }))}
            placeholder="Rule name"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          />
        </label>
        <label htmlFor={`${idPrefix}-pattern`} className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Match text</span>
          <input
            id={`${idPrefix}-pattern`}
            value={form.pattern}
            onChange={(e) => onSetForm((c) => ({ ...c, pattern: e.target.value }))}
            placeholder='Match text (example: "netflix|hulu|spotify")'
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          />
        </label>
        <label htmlFor={`${idPrefix}-classification`} className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Set behavior</span>
          <select
            id={`${idPrefix}-classification`}
            value={form.classification}
            onChange={(e) => onSetForm((c) => ({ ...c, classification: e.target.value as SubscriptionClassification }))}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          >
            <option value="needs_review">Needs review</option>
            <option value="subscription">Subscription</option>
            <option value="bill_loan">Bill/Loan</option>
            <option value="transfer">Transfer</option>
            <option value="ignore">Ignore</option>
          </select>
        </label>
        <label htmlFor={`${idPrefix}-force-merchant`} className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Rename merchant to (optional)</span>
          <input
            id={`${idPrefix}-force-merchant`}
            value={form.forceMerchant}
            onChange={(e) => onSetForm((c) => ({ ...c, forceMerchant: e.target.value }))}
            placeholder='Rename merchant to (optional, example: "COMCAST")'
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          />
        </label>
        <button type="button" onClick={onToggleAdvanced} className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
          {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
        </button>
        {showAdvanced && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label htmlFor={`${idPrefix}-match-type`} className="space-y-1 text-sm">
                <span className="text-muted-foreground">Match type</span>
                <select
                  id={`${idPrefix}-match-type`}
                  value={form.matchType}
                  onChange={(e) => onSetForm((c) => ({ ...c, matchType: e.target.value as 'contains' | 'equals' | 'regex' }))}
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
              <label htmlFor={`${idPrefix}-cadence`} className="space-y-1 text-sm">
                <span className="text-muted-foreground">Cadence</span>
                <select
                  id={`${idPrefix}-cadence`}
                  value={form.cadence}
                  onChange={(e) => onSetForm((c) => ({ ...c, cadence: e.target.value as '' | SubscriptionCadence }))}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                >
                  <option value="">Any cadence</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="unknown">Unknown</option>
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
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label htmlFor={`${idPrefix}-min-amount`} className="space-y-1 text-sm">
                <span className="text-muted-foreground">Min amount</span>
                <input
                  id={`${idPrefix}-min-amount`}
                  type="number"
                  step="0.01"
                  value={form.minAmount}
                  onChange={(e) => onSetForm((c) => ({ ...c, minAmount: e.target.value }))}
                  placeholder="Min amount"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                />
              </label>
              <label htmlFor={`${idPrefix}-max-amount`} className="space-y-1 text-sm">
                <span className="text-muted-foreground">Max amount</span>
                <input
                  id={`${idPrefix}-max-amount`}
                  type="number"
                  step="0.01"
                  value={form.maxAmount}
                  onChange={(e) => onSetForm((c) => ({ ...c, maxAmount: e.target.value }))}
                  placeholder="Max amount"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                />
              </label>
              <label htmlFor={`${idPrefix}-target-amount`} className="space-y-1 text-sm">
                <span className="text-muted-foreground">Target amount</span>
                <input
                  id={`${idPrefix}-target-amount`}
                  type="number"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={(e) => onSetForm((c) => ({ ...c, targetAmount: e.target.value }))}
                  placeholder="Target amount"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                />
              </label>
              <label htmlFor={`${idPrefix}-tolerance`} className="space-y-1 text-sm">
                <span className="text-muted-foreground">Tolerance (0 to 1)</span>
                <input
                  id={`${idPrefix}-tolerance`}
                  type="number"
                  step="0.01"
                  value={form.tolerancePct}
                  onChange={(e) => onSetForm((c) => ({ ...c, tolerancePct: e.target.value }))}
                  placeholder="Tolerance (0 to 1)"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                />
              </label>
            </div>
            <label htmlFor={`${idPrefix}-explanation`} className="space-y-1 text-sm">
              <span className="text-muted-foreground">Explanation (optional)</span>
              <textarea
                id={`${idPrefix}-explanation`}
                value={form.explanation}
                onChange={(e) => onSetForm((c) => ({ ...c, explanation: e.target.value }))}
                placeholder="Explanation (optional)"
                rows={2}
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
        Add behavior rule
      </button>
    </form>
  )
}
