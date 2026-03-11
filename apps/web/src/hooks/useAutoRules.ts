import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { AccountOption, CategoryOption, OwnerValue } from '@/lib/types'

export type AutoRuleType =
  | 'merchant_contains'
  | 'merchant_exact'
  | 'merchant_contains_account'
  | 'merchant_contains_amount_range'

export type AutoRuleRow = {
  id: string
  rule_type: AutoRuleType
  merchant_pattern: string
  account_id: string | null
  min_amount: number | string | null
  max_amount: number | string | null
  category_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type OwnerAutoRuleRow = {
  id: string
  rule_type: AutoRuleType
  merchant_pattern: string
  account_id: string | null
  min_amount: number | string | null
  max_amount: number | string | null
  set_owner: Exclude<OwnerValue, 'unknown'>
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AutoRuleFormState = {
  ruleType: AutoRuleType
  merchantPattern: string
  accountId: string
  minAmount: string
  maxAmount: string
  categoryId: string
  isActive: boolean
}

export type OwnerAutoRuleFormState = {
  ruleType: AutoRuleType
  merchantPattern: string
  accountId: string
  minAmount: string
  maxAmount: string
  setOwner: Exclude<OwnerValue, 'unknown'> | ''
  isActive: boolean
}

const EMPTY_AUTO_RULE_FORM: AutoRuleFormState = {
  ruleType: 'merchant_contains',
  merchantPattern: '',
  accountId: '',
  minAmount: '',
  maxAmount: '',
  categoryId: '',
  isActive: true,
}

const EMPTY_OWNER_AUTO_RULE_FORM: OwnerAutoRuleFormState = {
  ruleType: 'merchant_contains',
  merchantPattern: '',
  accountId: '',
  minAmount: '',
  maxAmount: '',
  setOwner: '',
  isActive: true,
}

type ManualRuleMatchType = 'contains' | 'equals' | 'regex'

type ManualRuleRow = {
  id: string
  name: string | null
  pattern: string
  match_type: ManualRuleMatchType
  account_id: string | null
  min_amount: number | string | null
  max_amount: number | string | null
  set_spending_category_id: string | null
}

function parseOptionalAmount(value: string): number | null | typeof Number.NaN {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function toOptionalNumber(value: number | string | null): number | null {
  if (value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isDuplicateCategoryRuleError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').includes('uq_transaction_category_rules_v1_signature')
}

function isDuplicateOwnerRuleError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').includes('uq_transaction_owner_rules_v1_signature')
}

export function autoRuleTypeLabel(type: AutoRuleType): string {
  if (type === 'merchant_exact') return 'Merchant exact'
  if (type === 'merchant_contains_account') return 'Merchant contains + account'
  if (type === 'merchant_contains_amount_range') return 'Merchant contains + amount range'
  return 'Merchant contains'
}

export function autoRuleAmountLabel(value: number | string | null): string {
  if (value === null || value === '') return 'Any'
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return 'Any'
  return numeric.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function validateCommonRuleFields(form: {
  ruleType: AutoRuleType
  merchantPattern: string
  accountId: string
  minAmount: string
  maxAmount: string
}): string | null {
  const merchantPattern = form.merchantPattern.trim()
  if (!merchantPattern) return 'Merchant pattern is required.'

  const minAmount = parseOptionalAmount(form.minAmount)
  const maxAmount = parseOptionalAmount(form.maxAmount)
  if (Number.isNaN(minAmount) || Number.isNaN(maxAmount)) {
    return 'Amount bounds must be valid numbers.'
  }

  if (form.ruleType === 'merchant_contains_account' && !form.accountId) {
    return 'Choose an account for account-scoped rules.'
  }

  if (form.ruleType === 'merchant_contains_amount_range') {
    if (minAmount === null || maxAmount === null) {
      return 'Min and max amounts are required for amount-range rules.'
    }
    if (minAmount < 0 || maxAmount < 0) {
      return 'Amounts must be zero or greater.'
    }
    if (minAmount > maxAmount) {
      return 'Min amount cannot exceed max amount.'
    }
  } else if (minAmount !== null || maxAmount !== null) {
    return 'Amount bounds are only supported for "merchant contains + amount range".'
  }

  return null
}

function mapManualRuleToAutoRulePayload(rule: ManualRuleRow): {
  payload: {
    rule_type: AutoRuleType
    merchant_pattern: string
    account_id: string | null
    min_amount: number | null
    max_amount: number | null
    category_id: string
    is_active: boolean
  } | null
  skippedReason: string | null
} {
  const merchantPattern = rule.pattern.trim()
  const categoryId = rule.set_spending_category_id
  if (!merchantPattern || !categoryId) {
    return { payload: null, skippedReason: 'Missing merchant pattern or category.' }
  }

  if (rule.match_type === 'regex') {
    return { payload: null, skippedReason: 'Regex rules are not supported in Auto Rules.' }
  }

  const minAmount = toOptionalNumber(rule.min_amount)
  const maxAmount = toOptionalNumber(rule.max_amount)
  const hasAccountScope = Boolean(rule.account_id)
  const hasAmountRange = minAmount !== null || maxAmount !== null

  if (hasAccountScope && hasAmountRange) {
    return { payload: null, skippedReason: 'Account + amount-range combo is not supported in Auto Rules.' }
  }

  if (hasAmountRange && (minAmount === null || maxAmount === null)) {
    return { payload: null, skippedReason: 'Amount-range rules require both min and max amounts.' }
  }

  if (rule.match_type === 'equals') {
    if (hasAccountScope || hasAmountRange) {
      return { payload: null, skippedReason: 'Exact-match rules with extra scopes are not supported in Auto Rules.' }
    }
    return {
      payload: {
        rule_type: 'merchant_exact',
        merchant_pattern: merchantPattern,
        account_id: null,
        min_amount: null,
        max_amount: null,
        category_id: categoryId,
        is_active: true,
      },
      skippedReason: null,
    }
  }

  if (hasAccountScope) {
    return {
      payload: {
        rule_type: 'merchant_contains_account',
        merchant_pattern: merchantPattern,
        account_id: rule.account_id,
        min_amount: null,
        max_amount: null,
        category_id: categoryId,
        is_active: true,
      },
      skippedReason: null,
    }
  }

  if (hasAmountRange) {
    return {
      payload: {
        rule_type: 'merchant_contains_amount_range',
        merchant_pattern: merchantPattern,
        account_id: null,
        min_amount: minAmount,
        max_amount: maxAmount,
        category_id: categoryId,
        is_active: true,
      },
      skippedReason: null,
    }
  }

  return {
    payload: {
      rule_type: 'merchant_contains',
      merchant_pattern: merchantPattern,
      account_id: null,
      min_amount: null,
      max_amount: null,
      category_id: categoryId,
      is_active: true,
    },
    skippedReason: null,
  }
}

export function useAutoRules(userId: string | undefined) {
  const [rules, setRules] = useState<AutoRuleRow[]>([])
  const [ownerRules, setOwnerRules] = useState<OwnerAutoRuleRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingForm, setEditingForm] = useState<AutoRuleFormState>(EMPTY_AUTO_RULE_FORM)
  const [newRuleForm, setNewRuleForm] = useState<AutoRuleFormState>(EMPTY_AUTO_RULE_FORM)
  const [ownerEditingId, setOwnerEditingId] = useState('')
  const [ownerEditingForm, setOwnerEditingForm] = useState<OwnerAutoRuleFormState>(EMPTY_OWNER_AUTO_RULE_FORM)
  const [newOwnerRuleForm, setNewOwnerRuleForm] = useState<OwnerAutoRuleFormState>(EMPTY_OWNER_AUTO_RULE_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules])
  const activeOwnerCount = useMemo(() => ownerRules.filter((rule) => rule.is_active).length, [ownerRules])

  const loadData = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    setError('')

    const [rulesResult, ownerRulesResult, accountsResult, categoriesResult] = await Promise.all([
      supabase
        .from('transaction_category_rules_v1')
        .select('id, rule_type, merchant_pattern, account_id, min_amount, max_amount, category_id, is_active, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('transaction_owner_rules_v1')
        .select('id, rule_type, merchant_pattern, account_id, min_amount, max_amount, set_owner, is_active, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true }),
      supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true }),
    ])

    if (rulesResult.error || ownerRulesResult.error || accountsResult.error || categoriesResult.error) {
      setError('Could not load sync-time category/owner rules.')
      setFetching(false)
      return
    }

    setRules((rulesResult.data ?? []) as AutoRuleRow[])
    setOwnerRules((ownerRulesResult.data ?? []) as OwnerAutoRuleRow[])
    setAccounts((accountsResult.data ?? []) as AccountOption[])
    setCategories((categoriesResult.data ?? []) as CategoryOption[])
    setFetching(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setFetching(false)
      return
    }
    void loadData()
  }, [loadData, userId])

  const validateCategoryForm = useCallback((form: AutoRuleFormState): string | null => {
    const commonError = validateCommonRuleFields(form)
    if (commonError) return commonError
    if (!form.categoryId) return 'Category is required.'
    return null
  }, [])

  const validateOwnerForm = useCallback((form: OwnerAutoRuleFormState): string | null => {
    const commonError = validateCommonRuleFields(form)
    if (commonError) return commonError
    if (!form.setOwner) return 'Owner is required.'
    return null
  }, [])

  const createRule = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) return

    const validationError = validateCategoryForm(newRuleForm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const minAmount = parseOptionalAmount(newRuleForm.minAmount)
    const maxAmount = parseOptionalAmount(newRuleForm.maxAmount)

    const { error: insertError } = await supabase.from('transaction_category_rules_v1').insert({
      user_id: userId,
      rule_type: newRuleForm.ruleType,
      merchant_pattern: newRuleForm.merchantPattern.trim(),
      account_id: newRuleForm.ruleType === 'merchant_contains_account' ? newRuleForm.accountId : null,
      min_amount: newRuleForm.ruleType === 'merchant_contains_amount_range' ? minAmount : null,
      max_amount: newRuleForm.ruleType === 'merchant_contains_amount_range' ? maxAmount : null,
      category_id: newRuleForm.categoryId,
      is_active: newRuleForm.isActive,
    })

    if (insertError) {
      setError(isDuplicateCategoryRuleError(insertError) ? 'An identical category rule already exists.' : 'Could not create category auto rule.')
      setSubmitting(false)
      return
    }

    setMessage('Category auto rule created.')
    setNewRuleForm((current) => ({
      ...EMPTY_AUTO_RULE_FORM,
      ruleType: current.ruleType,
      isActive: current.isActive,
    }))
    setSubmitting(false)
    await loadData()
  }, [loadData, newRuleForm, userId, validateCategoryForm])

  const startEdit = useCallback((rule: AutoRuleRow) => {
    setEditingId(rule.id)
    setEditingForm({
      ruleType: rule.rule_type,
      merchantPattern: rule.merchant_pattern,
      accountId: rule.account_id ?? '',
      minAmount: rule.min_amount === null ? '' : String(rule.min_amount),
      maxAmount: rule.max_amount === null ? '' : String(rule.max_amount),
      categoryId: rule.category_id,
      isActive: rule.is_active,
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId('')
    setEditingForm(EMPTY_AUTO_RULE_FORM)
  }, [])

  const saveEdit = useCallback(async (ruleId: string) => {
    if (!userId) return

    const validationError = validateCategoryForm(editingForm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const minAmount = parseOptionalAmount(editingForm.minAmount)
    const maxAmount = parseOptionalAmount(editingForm.maxAmount)

    const { error: updateError } = await supabase
      .from('transaction_category_rules_v1')
      .update({
        rule_type: editingForm.ruleType,
        merchant_pattern: editingForm.merchantPattern.trim(),
        account_id: editingForm.ruleType === 'merchant_contains_account' ? editingForm.accountId : null,
        min_amount: editingForm.ruleType === 'merchant_contains_amount_range' ? minAmount : null,
        max_amount: editingForm.ruleType === 'merchant_contains_amount_range' ? maxAmount : null,
        category_id: editingForm.categoryId,
        is_active: editingForm.isActive,
      })
      .eq('id', ruleId)
      .eq('user_id', userId)

    if (updateError) {
      setError(isDuplicateCategoryRuleError(updateError) ? 'An identical category rule already exists.' : 'Could not update category auto rule.')
      setSubmitting(false)
      return
    }

    setMessage('Category auto rule updated.')
    setSubmitting(false)
    cancelEdit()
    await loadData()
  }, [cancelEdit, editingForm, loadData, userId, validateCategoryForm])

  const toggleActive = useCallback(async (rule: AutoRuleRow) => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: toggleError } = await supabase
      .from('transaction_category_rules_v1')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
      .eq('user_id', userId)

    if (toggleError) {
      setError('Could not update category auto rule state.')
      setSubmitting(false)
      return
    }

    setMessage(rule.is_active ? 'Category auto rule deactivated.' : 'Category auto rule activated.')
    setSubmitting(false)
    await loadData()
  }, [loadData, userId])

  const deleteRule = useCallback(async (ruleId: string) => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('transaction_category_rules_v1')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId)

    if (deleteError) {
      setError('Could not delete category auto rule.')
      setSubmitting(false)
      return
    }

    setMessage('Category auto rule deleted.')
    setSubmitting(false)
    if (editingId === ruleId) {
      cancelEdit()
    }
    await loadData()
  }, [cancelEdit, editingId, loadData, userId])

  const createOwnerRule = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) return

    const validationError = validateOwnerForm(newOwnerRuleForm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const minAmount = parseOptionalAmount(newOwnerRuleForm.minAmount)
    const maxAmount = parseOptionalAmount(newOwnerRuleForm.maxAmount)

    const { error: insertError } = await supabase.from('transaction_owner_rules_v1').insert({
      user_id: userId,
      rule_type: newOwnerRuleForm.ruleType,
      merchant_pattern: newOwnerRuleForm.merchantPattern.trim(),
      account_id: newOwnerRuleForm.ruleType === 'merchant_contains_account' ? newOwnerRuleForm.accountId : null,
      min_amount: newOwnerRuleForm.ruleType === 'merchant_contains_amount_range' ? minAmount : null,
      max_amount: newOwnerRuleForm.ruleType === 'merchant_contains_amount_range' ? maxAmount : null,
      set_owner: newOwnerRuleForm.setOwner,
      is_active: newOwnerRuleForm.isActive,
    })

    if (insertError) {
      setError(isDuplicateOwnerRuleError(insertError) ? 'An identical owner rule already exists.' : 'Could not create owner auto rule.')
      setSubmitting(false)
      return
    }

    setMessage('Owner auto rule created.')
    setNewOwnerRuleForm((current) => ({
      ...EMPTY_OWNER_AUTO_RULE_FORM,
      ruleType: current.ruleType,
      setOwner: current.setOwner,
      isActive: current.isActive,
    }))
    setSubmitting(false)
    await loadData()
  }, [loadData, newOwnerRuleForm, userId, validateOwnerForm])

  const startOwnerEdit = useCallback((rule: OwnerAutoRuleRow) => {
    setOwnerEditingId(rule.id)
    setOwnerEditingForm({
      ruleType: rule.rule_type,
      merchantPattern: rule.merchant_pattern,
      accountId: rule.account_id ?? '',
      minAmount: rule.min_amount === null ? '' : String(rule.min_amount),
      maxAmount: rule.max_amount === null ? '' : String(rule.max_amount),
      setOwner: rule.set_owner,
      isActive: rule.is_active,
    })
  }, [])

  const cancelOwnerEdit = useCallback(() => {
    setOwnerEditingId('')
    setOwnerEditingForm(EMPTY_OWNER_AUTO_RULE_FORM)
  }, [])

  const saveOwnerEdit = useCallback(async (ruleId: string) => {
    if (!userId) return

    const validationError = validateOwnerForm(ownerEditingForm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const minAmount = parseOptionalAmount(ownerEditingForm.minAmount)
    const maxAmount = parseOptionalAmount(ownerEditingForm.maxAmount)

    const { error: updateError } = await supabase
      .from('transaction_owner_rules_v1')
      .update({
        rule_type: ownerEditingForm.ruleType,
        merchant_pattern: ownerEditingForm.merchantPattern.trim(),
        account_id: ownerEditingForm.ruleType === 'merchant_contains_account' ? ownerEditingForm.accountId : null,
        min_amount: ownerEditingForm.ruleType === 'merchant_contains_amount_range' ? minAmount : null,
        max_amount: ownerEditingForm.ruleType === 'merchant_contains_amount_range' ? maxAmount : null,
        set_owner: ownerEditingForm.setOwner,
        is_active: ownerEditingForm.isActive,
      })
      .eq('id', ruleId)
      .eq('user_id', userId)

    if (updateError) {
      setError(isDuplicateOwnerRuleError(updateError) ? 'An identical owner rule already exists.' : 'Could not update owner auto rule.')
      setSubmitting(false)
      return
    }

    setMessage('Owner auto rule updated.')
    setSubmitting(false)
    cancelOwnerEdit()
    await loadData()
  }, [cancelOwnerEdit, loadData, ownerEditingForm, userId, validateOwnerForm])

  const toggleOwnerRuleActive = useCallback(async (rule: OwnerAutoRuleRow) => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: toggleError } = await supabase
      .from('transaction_owner_rules_v1')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
      .eq('user_id', userId)

    if (toggleError) {
      setError('Could not update owner auto rule state.')
      setSubmitting(false)
      return
    }

    setMessage(rule.is_active ? 'Owner auto rule deactivated.' : 'Owner auto rule activated.')
    setSubmitting(false)
    await loadData()
  }, [loadData, userId])

  const deleteOwnerRule = useCallback(async (ruleId: string) => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('transaction_owner_rules_v1')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId)

    if (deleteError) {
      setError('Could not delete owner auto rule.')
      setSubmitting(false)
      return
    }

    setMessage('Owner auto rule deleted.')
    setSubmitting(false)
    if (ownerEditingId === ruleId) {
      cancelOwnerEdit()
    }
    await loadData()
  }, [cancelOwnerEdit, loadData, ownerEditingId, userId])

  const importFromManualRules = useCallback(async () => {
    if (!userId) return
    setSubmitting(true)
    setError('')
    setMessage('')

    const { data, error: loadManualRulesError } = await supabase
      .from('transaction_rules')
      .select('id, name, pattern, match_type, account_id, min_amount, max_amount, set_spending_category_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .not('set_spending_category_id', 'is', null)

    if (loadManualRulesError) {
      setError('Could not load manual rules for import.')
      setSubmitting(false)
      return
    }

    const manualRules = (data ?? []) as ManualRuleRow[]
    if (manualRules.length === 0) {
      setMessage('No eligible manual rules found to import.')
      setSubmitting(false)
      return
    }

    let imported = 0
    let duplicates = 0
    let skipped = 0
    let failed = 0

    for (const manualRule of manualRules) {
      const mapped = mapManualRuleToAutoRulePayload(manualRule)
      if (!mapped.payload) {
        skipped += 1
        continue
      }

      const { error: insertError } = await supabase.from('transaction_category_rules_v1').insert({
        user_id: userId,
        ...mapped.payload,
      })

      if (insertError) {
        if (isDuplicateCategoryRuleError(insertError)) {
          duplicates += 1
          continue
        }
        failed += 1
        continue
      }

      imported += 1
    }

    const summary = `Imported ${imported} rule(s), ${duplicates} duplicate(s), ${skipped} skipped, ${failed} failed.`
    if (failed > 0) {
      setError(`Manual-to-auto import completed with errors. ${summary}`)
    } else {
      setMessage(`Manual-to-auto import complete. ${summary}`)
    }
    setSubmitting(false)
    await loadData()
  }, [loadData, userId])

  return {
    rules,
    ownerRules,
    accounts,
    categories,
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
  }
}
