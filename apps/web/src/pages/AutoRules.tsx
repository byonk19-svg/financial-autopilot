import { useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  autoRuleAmountLabel,
  autoRuleTypeLabel,
  type AutoRuleFormState,
  type AutoRuleType,
  type OwnerAutoRuleFormState,
  useAutoRules,
} from '@/hooks/useAutoRules'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'

function ruleTypeDescription(ruleType: AutoRuleType): string {
  if (ruleType === 'merchant_exact') return 'Exact merchant text match only.'
  if (ruleType === 'merchant_contains_account') return 'Contains match scoped to one account.'
  if (ruleType === 'merchant_contains_amount_range') return 'Contains match + absolute amount range.'
  return 'Contains match across merchant text.'
}

function ownerLabel(value: string): string {
  if (value === 'brianna') return 'Brianna'
  if (value === 'elaine') return 'Elaine'
  return 'Household'
}

function CategoryAutoRuleForm({
  form,
  categories,
  accounts,
  submitting,
  title,
  submitLabel,
  onSetForm,
  onSubmit,
}: {
  form: AutoRuleFormState
  categories: Array<{ id: string; name: string }>
  accounts: Array<{ id: string; name: string }>
  submitting: boolean
  title: string
  submitLabel: string
  onSetForm: (updater: (current: AutoRuleFormState) => AutoRuleFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const showAccount = form.ruleType === 'merchant_contains_account'
  const showAmountRange = form.ruleType === 'merchant_contains_amount_range'

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ruleTypeDescription(form.ruleType)}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Rule type</span>
          <select
            value={form.ruleType}
            onChange={(event) =>
              onSetForm((current) => ({
                ...current,
                ruleType: event.target.value as AutoRuleType,
                accountId: '',
                minAmount: '',
                maxAmount: '',
              }))
            }
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          >
            <option value="merchant_contains">Merchant contains</option>
            <option value="merchant_exact">Merchant exact</option>
            <option value="merchant_contains_account">Merchant contains + account</option>
            <option value="merchant_contains_amount_range">Merchant contains + amount range</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Merchant pattern</span>
          <input
            type="text"
            value={form.merchantPattern}
            onChange={(event) => onSetForm((current) => ({ ...current, merchantPattern: event.target.value }))}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            placeholder="NETFLIX"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <select
            value={form.categoryId}
            onChange={(event) => onSetForm((current) => ({ ...current, categoryId: event.target.value }))}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {showAccount && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Account</span>
            <select
              value={form.accountId}
              onChange={(event) => onSetForm((current) => ({ ...current, accountId: event.target.value }))}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {showAmountRange && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Min amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.minAmount}
              onChange={(event) => onSetForm((current) => ({ ...current, minAmount: event.target.value }))}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              placeholder="0.00"
            />
          </label>
        )}

        {showAmountRange && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Max amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.maxAmount}
              onChange={(event) => onSetForm((current) => ({ ...current, maxAmount: event.target.value }))}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              placeholder="100.00"
            />
          </label>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
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
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function OwnerAutoRuleForm({
  form,
  accounts,
  submitting,
  title,
  submitLabel,
  onSetForm,
  onSubmit,
}: {
  form: OwnerAutoRuleFormState
  accounts: Array<{ id: string; name: string }>
  submitting: boolean
  title: string
  submitLabel: string
  onSetForm: (updater: (current: OwnerAutoRuleFormState) => OwnerAutoRuleFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const showAccount = form.ruleType === 'merchant_contains_account'
  const showAmountRange = form.ruleType === 'merchant_contains_amount_range'

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ruleTypeDescription(form.ruleType)}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Rule type</span>
          <select
            value={form.ruleType}
            onChange={(event) =>
              onSetForm((current) => ({
                ...current,
                ruleType: event.target.value as AutoRuleType,
                accountId: '',
                minAmount: '',
                maxAmount: '',
              }))
            }
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          >
            <option value="merchant_contains">Merchant contains</option>
            <option value="merchant_exact">Merchant exact</option>
            <option value="merchant_contains_account">Merchant contains + account</option>
            <option value="merchant_contains_amount_range">Merchant contains + amount range</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Merchant pattern</span>
          <input
            type="text"
            value={form.merchantPattern}
            onChange={(event) => onSetForm((current) => ({ ...current, merchantPattern: event.target.value }))}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            placeholder="SPOTIFY"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Assign owner</span>
          <select
            value={form.setOwner}
            onChange={(event) =>
              onSetForm((current) => ({
                ...current,
                setOwner: event.target.value as OwnerAutoRuleFormState['setOwner'],
              }))
            }
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
          >
            <option value="">Select owner</option>
            <option value="brianna">Brianna</option>
            <option value="elaine">Elaine</option>
            <option value="household">Household</option>
          </select>
        </label>

        {showAccount && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Account</span>
            <select
              value={form.accountId}
              onChange={(event) => onSetForm((current) => ({ ...current, accountId: event.target.value }))}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {showAmountRange && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Min amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.minAmount}
              onChange={(event) => onSetForm((current) => ({ ...current, minAmount: event.target.value }))}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              placeholder="0.00"
            />
          </label>
        )}

        {showAmountRange && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Max amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.maxAmount}
              onChange={(event) => onSetForm((current) => ({ ...current, maxAmount: event.target.value }))}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none ring-ring focus:border-primary focus:ring-2"
              placeholder="100.00"
            />
          </label>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
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
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function AutoRules() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const {
    rules,
    ownerRules,
    categories,
    accounts,
    fetching,
    submitting,
    editingId,
    editingForm,
    newRuleForm,
    ownerEditingId,
    ownerEditingForm,
    newOwnerRuleForm,
    error,
    message,
    activeCount,
    activeOwnerCount,
    setEditingForm,
    setNewRuleForm,
    setOwnerEditingForm,
    setNewOwnerRuleForm,
    createRule,
    startEdit,
    cancelEdit,
    saveEdit,
    toggleActive,
    deleteRule,
    createOwnerRule,
    startOwnerEdit,
    cancelOwnerEdit,
    saveOwnerEdit,
    toggleOwnerRuleActive,
    deleteOwnerRule,
    importFromManualRules,
  } = useAutoRules(session?.user?.id)

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate(getLoginRedirectPath(), { replace: true })
    }
  }, [loading, navigate, session])

  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]))
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]))

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Auto Rules</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sync-time rules applied by `simplefin-sync` when new transactions import.
              Use this as your long-term autopilot engine.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Category rules: {activeCount} active / {rules.length} total | Owner rules: {activeOwnerCount} active / {ownerRules.length} total
            </p>
          </div>
          <button
            type="button"
            disabled={submitting || fetching}
            onClick={() => {
              void importFromManualRules()
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Importing...' : 'Import Category Rules From Manual Rules'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Import maps active manual category rules into supported sync-time types.
          Owner auto rules are managed directly below.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CategoryAutoRuleForm
          form={newRuleForm}
          categories={categories}
          accounts={accounts}
          submitting={submitting}
          title="New Category Auto Rule"
          submitLabel="Create category rule"
          onSetForm={(updater) => setNewRuleForm(updater)}
          onSubmit={createRule}
        />

        <OwnerAutoRuleForm
          form={newOwnerRuleForm}
          accounts={accounts}
          submitting={submitting}
          title="New Owner Auto Rule"
          submitLabel="Create owner rule"
          onSetForm={(updater) => setNewOwnerRuleForm(updater)}
          onSubmit={createOwnerRule}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Saved Category Auto Rules</h2>
          {fetching ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading rules...</p>
          ) : rules.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No category auto rules yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {rules.map((rule) => {
                const editing = editingId === rule.id
                if (editing) {
                  return (
                    <article key={rule.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <CategoryAutoRuleForm
                        form={editingForm}
                        categories={categories}
                        accounts={accounts}
                        submitting={submitting}
                        title="Edit Category Auto Rule"
                        submitLabel="Save"
                        onSetForm={(updater) => setEditingForm(updater)}
                        onSubmit={(event) => {
                          event.preventDefault()
                          void saveEdit(rule.id)
                        }}
                      />
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={cancelEdit}
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
                  <article key={rule.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{rule.merchant_pattern}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {autoRuleTypeLabel(rule.rule_type)} | {categoryNameById.get(rule.category_id) ?? 'Unknown category'}
                        </p>
                        {rule.account_id ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Account: {accountNameById.get(rule.account_id) ?? 'Unknown account'}
                          </p>
                        ) : null}
                        {rule.rule_type === 'merchant_contains_amount_range' ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Amount: {autoRuleAmountLabel(rule.min_amount)} to {autoRuleAmountLabel(rule.max_amount)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated: {new Date(rule.updated_at).toLocaleString()}
                        </p>
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
                        onClick={() => startEdit(rule)}
                        disabled={submitting}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(rule)}
                        disabled={submitting}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rule.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRule(rule.id)}
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

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Saved Owner Auto Rules</h2>
          {fetching ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading rules...</p>
          ) : ownerRules.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No owner auto rules yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {ownerRules.map((rule) => {
                const editing = ownerEditingId === rule.id
                if (editing) {
                  return (
                    <article key={rule.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <OwnerAutoRuleForm
                        form={ownerEditingForm}
                        accounts={accounts}
                        submitting={submitting}
                        title="Edit Owner Auto Rule"
                        submitLabel="Save"
                        onSetForm={(updater) => setOwnerEditingForm(updater)}
                        onSubmit={(event) => {
                          event.preventDefault()
                          void saveOwnerEdit(rule.id)
                        }}
                      />
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={cancelOwnerEdit}
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
                  <article key={rule.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{rule.merchant_pattern}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {autoRuleTypeLabel(rule.rule_type)} | Owner: {ownerLabel(rule.set_owner)}
                        </p>
                        {rule.account_id ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Account: {accountNameById.get(rule.account_id) ?? 'Unknown account'}
                          </p>
                        ) : null}
                        {rule.rule_type === 'merchant_contains_amount_range' ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Amount: {autoRuleAmountLabel(rule.min_amount)} to {autoRuleAmountLabel(rule.max_amount)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated: {new Date(rule.updated_at).toLocaleString()}
                        </p>
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
                        onClick={() => startOwnerEdit(rule)}
                        disabled={submitting}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleOwnerRuleActive(rule)}
                        disabled={submitting}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rule.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteOwnerRule(rule.id)}
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
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
