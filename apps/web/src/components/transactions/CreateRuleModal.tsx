import { format } from 'date-fns'
import { useRef } from 'react'
import type { AccountOption, CategoryOption, CreateRuleFormState, TransactionRow } from '@/lib/types'
import { parseAmount } from '@/hooks/useTransactions.helpers'
import { useModalA11y } from '@/hooks/useModalA11y'

type CreateRuleModalProps = {
  transaction: TransactionRow
  ruleForm: CreateRuleFormState
  ruleModalError: string
  ruleModalSubmitting: boolean
  categories: CategoryOption[]
  accounts: AccountOption[]
  accountNameById: Map<string, string>
  onClose: () => void
  onFormChange: (updates: Partial<CreateRuleFormState>) => void
  onSubmit: () => void
}

export function CreateRuleModal({
  transaction,
  ruleForm,
  ruleModalError,
  ruleModalSubmitting,
  categories,
  accountNameById,
  onClose,
  onFormChange,
  onSubmit,
}: CreateRuleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const canonicalMerchantInputRef = useRef<HTMLInputElement>(null)

  useModalA11y({
    open: true,
    onClose,
    containerRef: modalRef,
    initialFocusRef: canonicalMerchantInputRef,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-transaction-rule-title"
    >
      <div ref={modalRef} tabIndex={-1} className="my-4 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl sm:my-0">
        <h3 id="create-transaction-rule-title" className="text-lg font-semibold text-foreground">
          Create rule from transaction
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Save a merchant matching rule and apply it to matching transactions.
        </p>

        <dl className="mt-4 grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Merchant</dt>
            <dd className="mt-1 text-foreground">
              {transaction.merchant_normalized ?? transaction.description_short}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</dt>
            <dd className="mt-1 text-foreground">
              {parseAmount(transaction.amount).toLocaleString(undefined, {
                style: 'currency',
                currency: transaction.currency || 'USD',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</dt>
            <dd className="mt-1 text-foreground">
              {format(new Date(transaction.posted_at), 'yyyy-MM-dd HH:mm')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</dt>
            <dd className="mt-1 text-foreground">
              {transaction.description_full ?? transaction.description_short}
            </dd>
          </div>
        </dl>

        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="create-rule-canonical-merchant"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Canonical merchant
            </label>
            <input
              ref={canonicalMerchantInputRef}
              id="create-rule-canonical-merchant"
              type="text"
              value={ruleForm.canonicalMerchant}
              disabled={ruleModalSubmitting}
              onChange={(event) => onFormChange({ canonicalMerchant: event.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Match type</p>
            <div className="flex flex-wrap items-center gap-2">
              {(['equals', 'contains'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={ruleModalSubmitting}
                  onClick={() => onFormChange({ matchType: type })}
                  className={`min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 md:px-3 md:py-1.5 ${
                    ruleForm.matchType === type
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border text-foreground hover:bg-muted'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Apply scope</p>
            <select
              value={ruleForm.applyScope}
              disabled={ruleModalSubmitting}
              onChange={(event) =>
                onFormChange({ applyScope: event.target.value as CreateRuleFormState['applyScope'] })
              }
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="future_only">Future only</option>
              <option value="past_90_days">Past 90 days</option>
              <option value="all_history">All history</option>
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="create-rule-category"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Category
            </label>
            <select
              id="create-rule-category"
              value={ruleForm.categoryId}
              disabled={ruleModalSubmitting}
              onChange={(event) => onFormChange({ categoryId: event.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={ruleForm.constrainToAccount}
              disabled={ruleModalSubmitting}
              onChange={(event) => onFormChange({ constrainToAccount: event.target.checked })}
              className="mt-0.5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>
              Restrict to this account
              <span className="block text-xs text-muted-foreground">
                {accountNameById.get(transaction.account_id) ?? 'Current account'}
              </span>
            </span>
          </label>
        </div>

        {ruleModalError ? (
          <div
            className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {ruleModalError}
          </div>
        ) : null}

        <div className="sticky bottom-0 mt-5 flex flex-wrap justify-end gap-2 border-t border bg-card pt-4">
          <button
            type="button"
            disabled={ruleModalSubmitting}
            onClick={onClose}
            className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 md:py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={ruleModalSubmitting}
            onClick={onSubmit}
            className="min-h-11 rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 md:py-1.5"
          >
            {ruleModalSubmitting ? 'Saving...' : 'Create rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
