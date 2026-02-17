import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { getAccessToken } from '@/lib/auth'
import { captureException } from '@/lib/errorReporting'
import { functionUrl } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import type { SubscriptionCadence, SubscriptionClassification } from '@/lib/types'

type MatchType = 'contains' | 'equals' | 'regex'

export type AliasRow = {
  id: number
  pattern: string
  normalized: string
  kind_hint: string | null
  match_type: MatchType
  priority: number
  is_active: boolean
  account_id: string | null
  updated_at: string
}

export type TransactionRuleRow = {
  id: string
  name: string
  pattern: string
  match_type: MatchType
  account_id: string | null
  cadence: SubscriptionCadence | null
  min_amount: number | string | null
  max_amount: number | string | null
  target_amount: number | string | null
  amount_tolerance_pct: number | string | null
  set_merchant_normalized: string | null
  set_pattern_classification: SubscriptionClassification | null
  explanation: string | null
  priority: number
  is_active: boolean
  updated_at: string
}

type AccountRow = { id: string; name: string; institution: string | null }
export type RunState = { requestId: string; ok: boolean; message: string; at: string }

export type AliasForm = {
  pattern: string
  normalized: string
  matchType: MatchType
  priority: string
  accountId: string
  isActive: boolean
}

export type RuleForm = {
  name: string
  pattern: string
  classification: SubscriptionClassification
  forceMerchant: string
  matchType: MatchType
  accountId: string
  cadence: '' | SubscriptionCadence
  minAmount: string
  maxAmount: string
  targetAmount: string
  tolerancePct: string
  explanation: string
  priority: string
  isActive: boolean
}

export const EMPTY_ALIAS: AliasForm = {
  pattern: '',
  normalized: '',
  matchType: 'contains',
  priority: '100',
  accountId: '',
  isActive: true,
}

export const EMPTY_RULE: RuleForm = {
  name: '',
  pattern: '',
  classification: 'needs_review',
  forceMerchant: '',
  matchType: 'contains',
  accountId: '',
  cadence: '',
  minAmount: '',
  maxAmount: '',
  targetAmount: '',
  tolerancePct: '',
  explanation: '',
  priority: '100',
  isActive: true,
}

export const RULE_PRESETS: Array<{
  label: string
  name: string
  pattern: string
  classification: SubscriptionClassification
  forceMerchant?: string
}> = [
  {
    label: 'Streaming = Subscription',
    name: 'Streaming Services',
    pattern: 'netflix|hulu|spotify|disney',
    classification: 'subscription',
  },
  {
    label: 'Transfers',
    name: 'Bank Transfers',
    pattern: 'xfer|transfer|zelle|venmo|payment thank you',
    classification: 'transfer',
  },
  {
    label: 'Comcast Bill',
    name: 'Comcast Bill',
    pattern: 'comcast',
    classification: 'bill_loan',
    forceMerchant: 'COMCAST',
  },
]

export const ALIAS_PRESETS: Array<{ label: string; pattern: string; normalized: string }> = [
  { label: 'Comcast Houston -> COMCAST', pattern: 'comcast xfinity houston', normalized: 'COMCAST' },
  { label: 'apple.com/bill -> APPLE', pattern: 'apple.com/bill', normalized: 'APPLE' },
]

function parseOptionalNumber(value: string): number | null | typeof Number.NaN {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleString()
}

export function classificationLabel(value: SubscriptionClassification | null): string {
  if (!value) return 'No override'
  if (value === 'bill_loan') return 'Bill/Loan'
  if (value === 'needs_review') return 'Needs review'
  if (value === 'transfer') return 'Transfer'
  if (value === 'ignore') return 'Ignore'
  return 'Subscription'
}

export function friendlyRuleSummary(row: TransactionRuleRow): string {
  const base = `If transaction text ${row.match_type} "${row.pattern}"`
  const forcedClass = row.set_pattern_classification
    ? `classify as ${classificationLabel(row.set_pattern_classification)}`
    : ''
  const forcedMerchant = row.set_merchant_normalized
    ? `rename merchant to "${row.set_merchant_normalized}"`
    : ''
  const action = [forcedClass, forcedMerchant].filter(Boolean).join(' and ')
  return action ? `${base}, ${action}.` : `${base}.`
}

export function useRules(userId: string | undefined) {
  const [aliases, setAliases] = useState<AliasRow[]>([])
  const [rules, setRules] = useState<TransactionRuleRow[]>([])
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [aliasForm, setAliasForm] = useState<AliasForm>(EMPTY_ALIAS)
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [showAliasAdvanced, setShowAliasAdvanced] = useState(false)
  const [showRuleAdvanced, setShowRuleAdvanced] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const activeAliasCount = useMemo(() => aliases.filter((row) => row.is_active).length, [aliases])
  const activeRuleCount = useMemo(() => rules.filter((row) => row.is_active).length, [rules])

  const loadData = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    setError('')

    const [aliasResult, ruleResult, accountResult] = await Promise.all([
      supabase
        .from('merchant_aliases')
        .select('id, pattern, normalized, kind_hint, match_type, priority, is_active, account_id, updated_at')
        .eq('user_id', userId)
        .order('priority', { ascending: true })
        .order('updated_at', { ascending: false }),
      supabase
        .from('transaction_rules')
        .select(
          'id, name, pattern, match_type, account_id, cadence, min_amount, max_amount, target_amount, amount_tolerance_pct, set_merchant_normalized, set_pattern_classification, explanation, priority, is_active, updated_at',
        )
        .eq('user_id', userId)
        .order('priority', { ascending: true })
        .order('updated_at', { ascending: false }),
      supabase.from('accounts').select('id, name, institution').eq('user_id', userId).order('name', { ascending: true }),
    ])

    if (aliasResult.error || ruleResult.error || accountResult.error) {
      setError('Could not load rules.')
      setFetching(false)
      return
    }

    setAliases((aliasResult.data ?? []) as AliasRow[])
    setRules((ruleResult.data ?? []) as TransactionRuleRow[])
    setAccounts((accountResult.data ?? []) as AccountRow[])
    setFetching(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setFetching(false)
      return
    }
    void loadData()
  }, [loadData, userId])

  const submitAlias = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) return
    if (!aliasForm.pattern.trim() || !aliasForm.normalized.trim()) {
      setError('Pattern and normalized merchant are required.')
      return
    }

    const priority = Number.parseInt(aliasForm.priority, 10)
    if (!Number.isFinite(priority)) {
      setError('Priority must be an integer.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error: insertError } = await supabase.from('merchant_aliases').insert({
      user_id: userId,
      pattern: aliasForm.pattern.trim(),
      normalized: aliasForm.normalized.trim(),
      match_type: aliasForm.matchType,
      priority,
      account_id: aliasForm.accountId || null,
      is_active: aliasForm.isActive,
    })

    if (insertError) {
      setError('Could not create alias.')
      setSaving(false)
      return
    }

    setAliasForm(EMPTY_ALIAS)
    setSaving(false)
    setMessage('Alias created.')
    await loadData()
  }, [aliasForm, loadData, userId])

  const submitRule = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) return
    if (!ruleForm.name.trim() || !ruleForm.pattern.trim()) {
      setError('Rule name and pattern are required.')
      return
    }

    const priority = Number.parseInt(ruleForm.priority, 10)
    if (!Number.isFinite(priority)) {
      setError('Priority must be an integer.')
      return
    }

    const minAmount = parseOptionalNumber(ruleForm.minAmount)
    const maxAmount = parseOptionalNumber(ruleForm.maxAmount)
    const targetAmount = parseOptionalNumber(ruleForm.targetAmount)
    const tolerancePct = parseOptionalNumber(ruleForm.tolerancePct)

    if (Number.isNaN(minAmount) || Number.isNaN(maxAmount) || Number.isNaN(targetAmount) || Number.isNaN(tolerancePct)) {
      setError('Amount fields must be valid numbers.')
      return
    }

    if (tolerancePct !== null && (targetAmount === null || tolerancePct < 0 || tolerancePct > 1)) {
      setError('Tolerance requires target amount and must be between 0 and 1.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error: insertError } = await supabase.from('transaction_rules').insert({
      user_id: userId,
      name: ruleForm.name.trim(),
      pattern: ruleForm.pattern.trim(),
      match_type: ruleForm.matchType,
      account_id: ruleForm.accountId || null,
      cadence: ruleForm.cadence || null,
      min_amount: minAmount,
      max_amount: maxAmount,
      target_amount: targetAmount,
      amount_tolerance_pct: tolerancePct,
      set_merchant_normalized: ruleForm.forceMerchant.trim() || null,
      set_pattern_classification: ruleForm.classification,
      explanation: ruleForm.explanation.trim() || null,
      priority,
      is_active: ruleForm.isActive,
    })

    if (insertError) {
      setError('Could not create transaction rule.')
      setSaving(false)
      return
    }

    setRuleForm(EMPTY_RULE)
    setSaving(false)
    setMessage('Transaction rule created.')
    await loadData()
  }, [loadData, ruleForm, userId])

  const runAnalysisNow = useCallback(async () => {
    setRunning(true)
    setError('')
    setMessage('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Session expired. Please log in again.')

      const response = await fetch(functionUrl('analysis-daily'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        request_id?: string
        users_processed?: number
        subscriptions_upserted?: number
        alerts_inserted?: number
        error?: string
        detail?: string
      }

      if (!response.ok || payload.ok !== true) throw new Error(payload.detail ?? payload.error ?? 'Analysis failed.')

      setRunState({
        requestId: payload.request_id ?? `manual-${Date.now()}`,
        ok: true,
        at: new Date().toISOString(),
        message: `users: ${payload.users_processed ?? 0}, subscriptions: ${payload.subscriptions_upserted ?? 0}, alerts: ${payload.alerts_inserted ?? 0}`,
      })
      setMessage('Analysis run completed.')
      await loadData()
    } catch (runError) {
      captureException(runError, {
        component: 'useRules',
        action: 'run-analysis-now',
      })
      const detail = runError instanceof Error ? runError.message : 'Analysis failed.'
      setRunState({
        requestId: `manual-${Date.now()}`,
        ok: false,
        at: new Date().toISOString(),
        message: detail,
      })
      setError(detail)
    } finally {
      setRunning(false)
    }
  }, [loadData])

  const toggleAlias = useCallback(async (alias: AliasRow) => {
    if (!userId) return
    setSaving(true)
    await supabase.from('merchant_aliases').update({ is_active: !alias.is_active }).eq('id', alias.id).eq('user_id', userId)
    setSaving(false)
    await loadData()
  }, [loadData, userId])

  const deleteAlias = useCallback(async (alias: AliasRow) => {
    if (!userId) return
    setSaving(true)
    await supabase.from('merchant_aliases').delete().eq('id', alias.id).eq('user_id', userId)
    setSaving(false)
    await loadData()
  }, [loadData, userId])

  const toggleRule = useCallback(async (rule: TransactionRuleRow) => {
    if (!userId) return
    setSaving(true)
    await supabase.from('transaction_rules').update({ is_active: !rule.is_active }).eq('id', rule.id).eq('user_id', userId)
    setSaving(false)
    await loadData()
  }, [loadData, userId])

  const deleteRule = useCallback(async (rule: TransactionRuleRow) => {
    if (!userId) return
    setSaving(true)
    await supabase.from('transaction_rules').delete().eq('id', rule.id).eq('user_id', userId)
    setSaving(false)
    await loadData()
  }, [loadData, userId])

  return {
    aliases,
    rules,
    accounts,
    aliasForm,
    ruleForm,
    fetching,
    saving,
    running,
    showAliasAdvanced,
    showRuleAdvanced,
    runState,
    message,
    error,
    activeAliasCount,
    activeRuleCount,
    setAliasForm,
    setRuleForm,
    setShowAliasAdvanced,
    setShowRuleAdvanced,
    setMessage,
    setError,
    submitAlias,
    submitRule,
    runAnalysisNow,
    toggleAlias,
    deleteAlias,
    toggleRule,
    deleteRule,
    loadData,
  }
}
