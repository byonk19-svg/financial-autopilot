import type { FormEvent } from 'react'
import type { SubscriptionClassification } from '@/lib/types'
import type { ClassificationRuleFormState } from '@/hooks/useClassificationRules'

type ClassificationRuleFormProps = {
  form: ClassificationRuleFormState
  submitting: boolean
  onSetForm: (updater: (current: ClassificationRuleFormState) => ClassificationRuleFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ClassificationRuleForm({
  form,
  submitting,
  onSetForm,
  onSubmit,
}: ClassificationRuleFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New Rule</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Merchant</span>
          <input
            type="text"
            value={form.merchant}
            onChange={(event) => onSetForm((current) => ({ ...current, merchant: event.target.value }))}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            placeholder="NETFLIX"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Cadence</span>
          <select
            value={form.cadence}
            onChange={(event) =>
              onSetForm((current) => ({
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
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Classification</span>
          <select
            value={form.classification}
            onChange={(event) =>
              onSetForm((current) => ({
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
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Min Amount (optional)</span>
          <input
            type="number"
            step="0.01"
            value={form.minAmount}
            onChange={(event) => onSetForm((current) => ({ ...current, minAmount: event.target.value }))}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            placeholder="Any"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Max Amount (optional)</span>
          <input
            type="number"
            step="0.01"
            value={form.maxAmount}
            onChange={(event) => onSetForm((current) => ({ ...current, maxAmount: event.target.value }))}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            placeholder="Any"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => onSetForm((current) => ({ ...current, isActive: event.target.checked }))}
          />
          Active
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Create rule'}
        </button>
      </div>
    </form>
  )
}
