import type { SubscriptionClassification } from '@/lib/types'
import {
  classificationLabel,
  toCadenceLabel,
  toMoney,
  type ClassificationRuleFormState,
  type ClassificationRuleRow,
} from '@/hooks/useClassificationRules'

type ClassificationRulesListProps = {
  rules: ClassificationRuleRow[]
  fetching: boolean
  submitting: boolean
  editingId: string
  editingForm: ClassificationRuleFormState
  onSetEditingForm: (updater: (current: ClassificationRuleFormState) => ClassificationRuleFormState) => void
  onStartEdit: (rule: ClassificationRuleRow) => void
  onCancelEdit: () => void
  onSaveEdit: (ruleId: string) => Promise<void>
  onToggleActive: (rule: ClassificationRuleRow) => Promise<void>
  onDeleteRule: (ruleId: string) => Promise<void>
}

export function ClassificationRulesList({
  rules,
  fetching,
  submitting,
  editingId,
  editingForm,
  onSetEditingForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleActive,
  onDeleteRule,
}: ClassificationRulesListProps) {
  return (
    <div className="rounded-xl border border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Saved Rules</h2>
      {fetching ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading rules...</p>
      ) : rules.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No rules yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rules.map((rule) => {
            const editing = editingId === rule.id
            if (editing) {
              return (
                <article key={rule.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <input
                      type="text"
                      value={editingForm.merchant}
                      onChange={(event) => onSetEditingForm((current) => ({ ...current, merchant: event.target.value }))}
                      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                    />
                    <select
                      value={editingForm.cadence}
                      onChange={(event) =>
                        onSetEditingForm((current) => ({
                          ...current,
                          cadence: event.target.value as ClassificationRuleFormState['cadence'],
                        }))
                      }
                      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                    >
                      <option value="">Any cadence</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <select
                      value={editingForm.classification}
                      onChange={(event) =>
                        onSetEditingForm((current) => ({
                          ...current,
                          classification: event.target.value as SubscriptionClassification,
                        }))
                      }
                      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                    >
                      <option value="needs_review">Needs Review</option>
                      <option value="subscription">Subscription</option>
                      <option value="bill_loan">Bill/Loan</option>
                      <option value="transfer">Transfer</option>
                      <option value="ignore">Ignore</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={editingForm.minAmount}
                      onChange={(event) => onSetEditingForm((current) => ({ ...current, minAmount: event.target.value }))}
                      placeholder="Min amount"
                      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editingForm.maxAmount}
                      onChange={(event) => onSetEditingForm((current) => ({ ...current, maxAmount: event.target.value }))}
                      placeholder="Max amount"
                      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={editingForm.isActive}
                        onChange={(event) =>
                          onSetEditingForm((current) => ({
                            ...current,
                            isActive: event.target.checked,
                          }))
                        }
                      />
                      Active
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onSaveEdit(rule.id)}
                      disabled={submitting}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      disabled={submitting}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              )
            }

            return (
              <article key={rule.id} className="rounded-lg border border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{rule.merchant_normalized}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {classificationLabel(rule.classification)} • {toCadenceLabel(rule.cadence)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Amount range: {toMoney(rule.min_amount)} to {toMoney(rule.max_amount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Updated: {new Date(rule.updated_at).toLocaleString()}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onStartEdit(rule)}
                    disabled={submitting}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void onToggleActive(rule)}
                    disabled={submitting}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rule.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteRule(rule.id)}
                    disabled={submitting}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 transition-colors-fast hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
