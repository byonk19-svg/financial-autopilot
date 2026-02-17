import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SubscriptionCadence, SubscriptionClassification } from '@/lib/types'
import { supabase } from '@/lib/supabase'

export type ClassificationRuleRow = {
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

export type ClassificationRuleFormState = {
  merchant: string
  cadence: '' | SubscriptionCadence
  minAmount: string
  maxAmount: string
  classification: SubscriptionClassification
  isActive: boolean
}

export const EMPTY_CLASSIFICATION_FORM: ClassificationRuleFormState = {
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

export function toMoney(value: number | string | null): string {
  if (value === null) return 'Any'
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return 'Any'
  return numeric.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function toCadenceLabel(value: SubscriptionCadence | null): string {
  if (value === null) return 'Any cadence'
  if (value === 'unknown') return 'Unknown cadence'
  return `${value[0].toUpperCase()}${value.slice(1)}`
}

export function classificationLabel(value: SubscriptionClassification): string {
  if (value === 'bill_loan') return 'Bill/Loan'
  if (value === 'needs_review') return 'Needs review'
  if (value === 'ignore') return 'Ignore'
  if (value === 'transfer') return 'Transfer'
  return 'Subscription'
}

export function useClassificationRules(userId: string | undefined) {
  const [rules, setRules] = useState<ClassificationRuleRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingForm, setEditingForm] = useState<ClassificationRuleFormState>(EMPTY_CLASSIFICATION_FORM)
  const [newRuleForm, setNewRuleForm] = useState<ClassificationRuleFormState>(EMPTY_CLASSIFICATION_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules])

  const loadRules = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('recurring_classification_rules')
      .select(
        'id, merchant_normalized, cadence, min_amount, max_amount, classification, is_active, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (loadError) {
      setError('Could not load classification rules.')
      setFetching(false)
      return
    }

    setRules((data ?? []) as ClassificationRuleRow[])
    setFetching(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setFetching(false)
      return
    }
    void loadRules()
  }, [loadRules, userId])

  const validateForm = useCallback((form: ClassificationRuleFormState): string | null => {
    if (!form.merchant.trim()) return 'Merchant is required.'
    const minAmount = toOptionalNumber(form.minAmount)
    const maxAmount = toOptionalNumber(form.maxAmount)
    if (Number.isNaN(minAmount) || Number.isNaN(maxAmount)) return 'Amount bounds must be valid numbers.'
    if (minAmount !== null && minAmount < 0) return 'Minimum amount cannot be negative.'
    if (maxAmount !== null && maxAmount < 0) return 'Maximum amount cannot be negative.'
    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) return 'Min amount cannot exceed max amount.'
    return null
  }, [])

  const createRule = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) return

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
      user_id: userId,
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
    setNewRuleForm(EMPTY_CLASSIFICATION_FORM)
    setSubmitting(false)
    await loadRules()
  }, [loadRules, newRuleForm, userId, validateForm])

  const startEdit = useCallback((rule: ClassificationRuleRow) => {
    setEditingId(rule.id)
    setEditingForm({
      merchant: rule.merchant_normalized,
      cadence: rule.cadence ?? '',
      minAmount: rule.min_amount === null ? '' : String(rule.min_amount),
      maxAmount: rule.max_amount === null ? '' : String(rule.max_amount),
      classification: rule.classification,
      isActive: rule.is_active,
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId('')
    setEditingForm(EMPTY_CLASSIFICATION_FORM)
  }, [])

  const saveEdit = useCallback(async (ruleId: string) => {
    if (!userId) return
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
      .eq('user_id', userId)

    if (updateError) {
      setError(updateError.message.includes('duplicate') ? 'An identical rule already exists.' : 'Could not update rule.')
      setSubmitting(false)
      return
    }

    setMessage('Rule updated.')
    setSubmitting(false)
    cancelEdit()
    await loadRules()
  }, [cancelEdit, editingForm, loadRules, userId, validateForm])

  const toggleActive = useCallback(async (rule: ClassificationRuleRow) => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('recurring_classification_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
      .eq('user_id', userId)

    if (updateError) {
      setError('Could not update rule state.')
      setSubmitting(false)
      return
    }

    setMessage(rule.is_active ? 'Rule deactivated.' : 'Rule activated.')
    setSubmitting(false)
    await loadRules()
  }, [loadRules, userId])

  const deleteRule = useCallback(async (ruleId: string) => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('recurring_classification_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId)

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
  }, [cancelEdit, editingId, loadRules, userId])

  return {
    rules,
    fetching,
    submitting,
    editingId,
    editingForm,
    newRuleForm,
    error,
    message,
    activeCount,
    setEditingForm,
    setNewRuleForm,
    createRule,
    startEdit,
    cancelEdit,
    saveEdit,
    toggleActive,
    deleteRule,
  }
}
