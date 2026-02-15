import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type SubscriptionClassification = 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore'
type SubscriptionCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'

type RuleRow = {
  id: string
  merchant_normalized: string
  cadence: SubscriptionCadence | null
  min_amount: number | string | null
  max_amount: number | string | null
  classification: SubscriptionClassification
  is_active: boolean
  created_at: string
  updated_at: string
}

type RuleFormState = {
  merchant: string
  cadence: '' | SubscriptionCadence
  minAmount: string
  maxAmount: string
  classification: SubscriptionClassification
  isActive: boolean
}

const EMPTY_FORM: RuleFormState = {
  merchant: '',
  cadence: '',
  minAmount: '',
  maxAmount: '',
  classification: 'needs_review',
  isActive: true,
}

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function toMoney(value: number | string | null): string {
  if (value === null) return 'Any'
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return 'Any'
  return numeric.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function toCadenceLabel(value: SubscriptionCadence | null): string {
  if (value === null) return 'Any cadence'
  if (value === 'unknown') return 'Unknown cadence'
  return `${value[0].toUpperCase()}${value.slice(1)}`
}

function classificationLabel(value: SubscriptionClassification): string {
  if (value === 'bill_loan') return 'Bill/Loan'
  if (value === 'needs_review') return 'Needs review'
  if (value === 'ignore') return 'Ignore'
  if (value === 'transfer') return 'Transfer'
  return 'Subscription'
}

export default function ClassificationRules() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  const [rules, setRules] = useState<RuleRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingForm, setEditingForm] = useState<RuleFormState>(EMPTY_FORM)
  const [newRuleForm, setNewRuleForm] = useState<RuleFormState>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules])

  const loadRules = async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('recurring_classification_rules')
      .select(
        'id, merchant_normalized, cadence, min_amount, max_amount, classification, is_active, created_at, updated_at',
      )
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    if (loadError) {
      setError('Could not load classification rules.')
      setFetching(false)
      return
    }

    setRules((data ?? []) as RuleRow[])
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    void loadRules()
  }, [loading, navigate, session])

  const validateForm = (form: RuleFormState): string | null => {
    if (!form.merchant.trim()) return 'Merchant is required.'
    const minAmount = toOptionalNumber(form.minAmount)
    const maxAmount = toOptionalNumber(form.maxAmount)
    if (Number.isNaN(minAmount) || Number.isNaN(maxAmount)) return 'Amount bounds must be valid numbers.'
    if (minAmount !== null && minAmount < 0) return 'Minimum amount cannot be negative.'
    if (maxAmount !== null && maxAmount < 0) return 'Maximum amount cannot be negative.'
    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) return 'Min amount cannot exceed max amount.'
    return null
  }

  const createRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session?.user) return

    const validationError = validateForm(newRuleForm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const minAmount = toOptionalNumber(newRuleForm.minAmount)
    const maxAmount = toOptionalNumber(newRuleForm.maxAmount)

    const { error: insertError } = await supabase.from('recurring_classification_rules').insert({
      user_id: session.user.id,
      merchant_normalized: newRuleForm.merchant.trim(),
      cadence: newRuleForm.cadence || null,
      min_amount: minAmount,
      max_amount: maxAmount,
      classification: newRuleForm.classification,
      is_active: newRuleForm.isActive,
    })

    if (insertError) {
      setError(insertError.message.includes('duplicate') ? 'An identical rule already exists.' : 'Could not create rule.')
      setSubmitting(false)
      return
    }

    setMessage('Rule created.')
    setNewRuleForm(EMPTY_FORM)
    setSubmitting(false)
    await loadRules()
  }

  const startEdit = (rule: RuleRow) => {
    setEditingId(rule.id)
    setEditingForm({
      merchant: rule.merchant_normalized,
      cadence: rule.cadence ?? '',
      minAmount: rule.min_amount === null ? '' : String(rule.min_amount),
      maxAmount: rule.max_amount === null ? '' : String(rule.max_amount),
      classification: rule.classification,
      isActive: rule.is_active,
    })
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditingForm(EMPTY_FORM)
  }

  const saveEdit = async (ruleId: string) => {
    if (!session?.user) return
    const validationError = validateForm(editingForm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const minAmount = toOptionalNumber(editingForm.minAmount)
    const maxAmount = toOptionalNumber(editingForm.maxAmount)

    const { error: updateError } = await supabase
      .from('recurring_classification_rules')
      .update({
        merchant_normalized: editingForm.merchant.trim(),
        cadence: editingForm.cadence || null,
        min_amount: minAmount,
        max_amount: maxAmount,
        classification: editingForm.classification,
        is_active: editingForm.isActive,
      })
      .eq('id', ruleId)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError(updateError.message.includes('duplicate') ? 'An identical rule already exists.' : 'Could not update rule.')
      setSubmitting(false)
      return
    }

    setMessage('Rule updated.')
    setSubmitting(false)
    cancelEdit()
    await loadRules()
  }

  const toggleActive = async (rule: RuleRow) => {
    if (!session?.user) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('recurring_classification_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError('Could not update rule state.')
      setSubmitting(false)
      return
    }

    setMessage(rule.is_active ? 'Rule deactivated.' : 'Rule activated.')
    setSubmitting(false)
    await loadRules()
  }

  const deleteRule = async (ruleId: string) => {
    if (!session?.user) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('recurring_classification_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', session.user.id)

    if (deleteError) {
      setError('Could not delete rule.')
      setSubmitting(false)
      return
    }

    setMessage('Rule deleted.')
    setSubmitting(false)
    if (editingId === ruleId) {
      cancelEdit()
    }
    await loadRules()
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Classification Rules</h1>
        <p className="mt-2 text-sm text-slate-600">
          Auto-apply recurring classifications by merchant, cadence, and optional amount range.
        </p>
        {!fetching && (
          <p className="mt-2 text-xs text-slate-500">
            {activeCount} active of {rules.length} total rules
          </p>
        )}
      </div>

      <form onSubmit={createRule} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">New Rule</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">Merchant</span>
            <input
              type="text"
              value={newRuleForm.merchant}
              onChange={(event) => setNewRuleForm((current) => ({ ...current, merchant: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="NETFLIX"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">Cadence</span>
            <select
              value={newRuleForm.cadence}
              onChange={(event) =>
                setNewRuleForm((current) => ({
                  ...current,
                  cadence: event.target.value as RuleFormState['cadence'],
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            <span className="text-slate-700">Classification</span>
            <select
              value={newRuleForm.classification}
              onChange={(event) =>
                setNewRuleForm((current) => ({
                  ...current,
                  classification: event.target.value as SubscriptionClassification,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="needs_review">Needs Review</option>
              <option value="subscription">Subscription</option>
              <option value="bill_loan">Bill/Loan</option>
              <option value="transfer">Transfer</option>
              <option value="ignore">Ignore</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">Min Amount (optional)</span>
            <input
              type="number"
              step="0.01"
              value={newRuleForm.minAmount}
              onChange={(event) => setNewRuleForm((current) => ({ ...current, minAmount: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Any"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">Max Amount (optional)</span>
            <input
              type="number"
              step="0.01"
              value={newRuleForm.maxAmount}
              onChange={(event) => setNewRuleForm((current) => ({ ...current, maxAmount: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Any"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newRuleForm.isActive}
              onChange={(event) => setNewRuleForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Create rule'}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Saved Rules</h2>
        {fetching ? (
          <p className="mt-3 text-sm text-slate-600">Loading rules...</p>
        ) : rules.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No rules yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rules.map((rule) => {
              const editing = editingId === rule.id
              if (editing) {
                return (
                  <article key={rule.id} className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <input
                        type="text"
                        value={editingForm.merchant}
                        onChange={(event) => setEditingForm((current) => ({ ...current, merchant: event.target.value }))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <select
                        value={editingForm.cadence}
                        onChange={(event) =>
                          setEditingForm((current) => ({
                            ...current,
                            cadence: event.target.value as RuleFormState['cadence'],
                          }))
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                          setEditingForm((current) => ({
                            ...current,
                            classification: event.target.value as SubscriptionClassification,
                          }))
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        onChange={(event) => setEditingForm((current) => ({ ...current, minAmount: event.target.value }))}
                        placeholder="Min amount"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editingForm.maxAmount}
                        onChange={(event) => setEditingForm((current) => ({ ...current, maxAmount: event.target.value }))}
                        placeholder="Max amount"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editingForm.isActive}
                          onChange={(event) =>
                            setEditingForm((current) => ({
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
                        onClick={() => void saveEdit(rule.id)}
                        disabled={submitting}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={submitting}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                )
              }

              return (
                <article key={rule.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{rule.merchant_normalized}</h3>
                      <p className="mt-1 text-xs text-slate-600">
                        {classificationLabel(rule.classification)} · {toCadenceLabel(rule.cadence)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Amount range: {toMoney(rule.min_amount)} to {toMoney(rule.max_amount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Updated: {new Date(rule.updated_at).toLocaleString()}</p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
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
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(rule)}
                      disabled={submitting}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rule.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRule(rule.id)}
                      disabled={submitting}
                      className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
