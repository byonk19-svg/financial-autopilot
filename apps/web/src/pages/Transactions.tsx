import { format } from 'date-fns'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TransactionFilterChips } from '@/components/transactions/TransactionFilterChips'
import { useTransactionFilterChips } from '@/hooks/useTransactionFilterChips'
import { useTransactionSelection } from '@/hooks/useTransactionSelection'
import type { AccountOption, CategoryOption, TransactionRow } from '@/lib/types'
import { inferRecurringClassificationFromCategory } from '@/lib/categoryRules'
import { captureException } from '../lib/errorReporting'
import { fetchFunctionWithAuth } from '../lib/fetchWithAuth'
import { getLoginRedirectPath } from '../lib/loginRedirect'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

const PAGE_SIZE = 50
const UNCATEGORIZED_VALUE = '__uncategorized__'
const FALLBACK_CATEGORY_NAMES = [
  'Payroll - Brianna',
  'Payroll - Elaine',
  'Other Income',
  'Groceries',
  'Dining & Restaurants',
  'Streaming & Apps',
  'Shopping',
  'Utilities & Internet',
  'Phone',
  'Mortgage & Housing',
  'Auto & Gas',
  'Healthcare',
  'Fertility - Progyny',
  'Pharmacy',
  'Insurance',
  'Investing',
  'Savings Transfer',
  'Credit Card Payment',
  'Loan Payment',
  'Childcare & School',
  'Pet',
  'Travel',
  'Fees & Charges',
  'Cash & ATM',
  'Other',
] as const
type SortColumn = 'posted_at' | 'amount' | 'merchant_normalized'
type SortDirection = 'asc' | 'desc'
type TransactionViewPreset = 'all' | 'elaine_income' | 'household_bills' | 'brianna_savings'
type RuleMatchType = 'equals' | 'contains'
type RuleApplyScope = 'future_only' | 'past_90_days' | 'all_history'
type TransactionSplitRow = {
  id: string
  transaction_id: string
  category_id: string | null
  amount: number | string
  memo: string | null
}
type TransactionSplitDraftLine = {
  draft_id: string
  id?: string
  category_id: string | null
  amount_input: string
  memo: string
}
type CreateRuleFormState = {
  canonicalMerchant: string
  matchType: RuleMatchType
  constrainToAccount: boolean
  categoryId: string
  applyScope: RuleApplyScope
}
type CategoryFollowUpAction = 'apply_similar' | 'apply_and_rule' | null
type CategoryFollowUpPromptState = {
  transactionId: string
  merchantCanonical: string
  accountId: string
  categoryId: string
  categoryName: string
  includeAccountScope: boolean
  pendingAction: CategoryFollowUpAction
}

const TRANSACTION_VIEW_PRESETS: Array<{ value: TransactionViewPreset; label: string }> = [
  { value: 'all', label: 'All Transactions' },
  { value: 'elaine_income', label: "Elaine's Income" },
  { value: 'household_bills', label: 'Household Bills' },
  { value: 'brianna_savings', label: "Brianna's Savings" },
]

const TRANSACTION_VIEW_PRESET_LABELS: Record<Exclude<TransactionViewPreset, 'all'>, string> = {
  elaine_income: "View: Elaine's Income",
  household_bills: 'View: Household Bills',
  brianna_savings: "View: Brianna's Savings",
}

function parseAmount(value: number | string): number {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toEndOfDayIso(value: string): string {
  return `${value}T23:59:59.999Z`
}

function toStartOfDayIso(value: string): string {
  return `${value}T00:00:00.000Z`
}

function buildSearchAndCategoryOrFilter(categoryId: string, searchQuery: string): string | null {
  let categoryPredicates: string[]
  if (categoryId === UNCATEGORIZED_VALUE) {
    categoryPredicates = ['and(user_category_id.is.null,category_id.is.null)']
  } else if (categoryId) {
    categoryPredicates = [`user_category_id.eq.${categoryId}`, `and(user_category_id.is.null,category_id.eq.${categoryId})`]
  } else {
    categoryPredicates = []
  }

  const searchPredicates = searchQuery
    ? [
        `merchant_normalized.ilike.%${searchQuery}%`,
        `description_short.ilike.%${searchQuery}%`,
      ]
    : []

  if (categoryPredicates.length && searchPredicates.length) {
    return categoryPredicates
      .flatMap((categoryPredicate) =>
        searchPredicates.map((searchPredicate) => `and(${categoryPredicate},${searchPredicate})`)
      )
      .join(',')
  }

  if (categoryPredicates.length) {
    return categoryPredicates.join(',')
  }

  if (searchPredicates.length) {
    return searchPredicates.join(',')
  }

  return null
}

function resolveRuleId(transaction: TransactionRow): string | null {
  if (transaction.rule_id) return transaction.rule_id
  const ref = transaction.classification_rule_ref
  if (!ref) return null
  const prefix = 'transaction_rule:'
  if (!ref.startsWith(prefix)) return null
  const possibleId = ref.slice(prefix.length)
  return possibleId.length > 0 ? possibleId : null
}

function detectCanonicalMerchant(transaction: TransactionRow): string {
  return (
    transaction.merchant_canonical ??
    transaction.merchant_normalized ??
    transaction.description_short ??
    ''
  ).trim()
}

function createSplitDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

function parseAmountInput(value: string): number {
  const parsed = Number.parseFloat(value.trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function isSplitTotalValid(total: number, amount: number): boolean {
  return Math.abs(total - amount) < 0.005
}

export default function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useSession()

  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [categoryUpdatingIds, setCategoryUpdatingIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'error' | 'info'; link?: { href: string; label: string } } | null>(null)
  const [categoryFollowUpPrompt, setCategoryFollowUpPrompt] = useState<CategoryFollowUpPromptState | null>(null)
  const [expandedTransactionIds, setExpandedTransactionIds] = useState<Set<string>>(new Set())
  const [ruleModalTransaction, setRuleModalTransaction] = useState<TransactionRow | null>(null)
  const [ruleForm, setRuleForm] = useState<CreateRuleFormState>({
    canonicalMerchant: '',
    matchType: 'equals',
    constrainToAccount: false,
    categoryId: '',
    applyScope: 'past_90_days',
  })
  const [ruleModalError, setRuleModalError] = useState('')
  const [ruleModalSubmitting, setRuleModalSubmitting] = useState(false)
  const [splitRowsByTransactionId, setSplitRowsByTransactionId] = useState<Record<string, TransactionSplitRow[]>>({})
  const [splitDraftsByTransactionId, setSplitDraftsByTransactionId] = useState<Record<string, TransactionSplitDraftLine[]>>({})
  const [splitSavingIds, setSplitSavingIds] = useState<Set<string>>(new Set())
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortColumn, setSortColumn] = useState<SortColumn>('posted_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [viewPreset, setViewPreset] = useState<TransactionViewPreset>('all')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(() => {
    const params = new URLSearchParams(location.search)
    const cat = params.get('category')
    return cat === UNCATEGORIZED_VALUE ? UNCATEGORIZED_VALUE : ''
  })
  const [showPending, setShowPending] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [search, setSearch] = useState('')
  const [createCategoryForTxnId, setCreateCategoryForTxnId] = useState<string | null>(null)
  const [createCategoryName, setCreateCategoryName] = useState('')
  const [createCategorySubmitting, setCreateCategorySubmitting] = useState(false)
  const [createCategoryError, setCreateCategoryError] = useState('')
  const selectVisibleRef = useRef<HTMLInputElement>(null)

  const handleStartDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(event.target.value)
    setPage(1)
  }, [])

  const handleEndDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(event.target.value)
    setPage(1)
  }, [])

  const handleAccountFilterChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setAccountFilter(event.target.value)
    setPage(1)
  }, [])

  const handleCategoryFilterChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(event.target.value)
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
    setPage(1)
  }, [])

  const handleViewPresetChange = useCallback((preset: TransactionViewPreset) => {
    setViewPreset(preset)
    setPage(1)
  }, [])

  const handlePreviousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPage((current) => current + 1)
  }, [])

  const handleSortChange = useCallback((column: SortColumn) => {
    setPage(1)
    setSortColumn((currentColumn) => {
      if (currentColumn === column) {
        setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'))
        return currentColumn
      }

      if (column === 'merchant_normalized') {
        setSortDirection('asc')
      } else {
        setSortDirection('desc')
      }
      return column
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setViewPreset('all')
    setStartDate('')
    setEndDate('')
    setAccountFilter('')
    setCategoryFilter('')
    setShowPending(false)
    setSearch('')
    setPage(1)
  }, [])

  const removeFilterChip = useCallback((key: 'view' | 'date_range' | 'account' | 'category' | 'search') => {
    if (key === 'view') {
      setViewPreset('all')
    } else if (key === 'date_range') {
      setStartDate('')
      setEndDate('')
    } else if (key === 'account') {
      setAccountFilter('')
    } else if (key === 'category') {
      setCategoryFilter('')
    } else if (key === 'search') {
      setSearch('')
    }
    setPage(1)
  }, [])

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) map.set(category.id, category.name)
    return map
  }, [categories])

  const { chips: activeFilterChips, hasActiveFilters } = useTransactionFilterChips({
    viewPresetLabel: viewPreset === 'all' ? null : TRANSACTION_VIEW_PRESET_LABELS[viewPreset],
    startDate,
    endDate,
    accountFilter,
    categoryFilter,
    search,
    accountNameById,
    categoryNameById,
  })

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount])
  const hasPreviousPage = page > 1
  const hasNextPage = page < totalPages
  const visibleTransactionIds = useMemo(() => transactions.map((transaction) => transaction.id), [transactions])

  const {
    allVisibleSelected,
    someVisibleSelected,
    selectedIdsArray,
    selectedCount,
    isSelected,
    toggleOne,
    toggleAllVisible,
    replaceSelection,
    clearSelection,
    keepOnlyVisible,
  } = useTransactionSelection(visibleTransactionIds)

  const createSplitDraftFromRows = useCallback(
    (transaction: TransactionRow, rows: TransactionSplitRow[] | undefined): TransactionSplitDraftLine[] => {
      if (rows && rows.length > 0) {
        return rows.map((row) => ({
          draft_id: createSplitDraftId(),
          id: row.id,
          category_id: row.category_id,
          amount_input: formatAmountInput(parseAmount(row.amount)),
          memo: row.memo ?? '',
        }))
      }

      return [
        {
          draft_id: createSplitDraftId(),
          category_id: transaction.user_category_id ?? transaction.category_id ?? null,
          amount_input: formatAmountInput(parseAmount(transaction.amount)),
          memo: '',
        },
      ]
    },
    [],
  )

  const ensureSplitDraftForTransaction = useCallback(
    (transaction: TransactionRow) => {
      setSplitDraftsByTransactionId((current) => {
        if (current[transaction.id]) return current
        return {
          ...current,
          [transaction.id]: createSplitDraftFromRows(transaction, splitRowsByTransactionId[transaction.id]),
        }
      })
    },
    [createSplitDraftFromRows, splitRowsByTransactionId],
  )

  const toggleTransactionDetails = useCallback((transaction: TransactionRow) => {
    setExpandedTransactionIds((current) => {
      const next = new Set(current)
      if (next.has(transaction.id)) {
        next.delete(transaction.id)
      } else {
        next.add(transaction.id)
      }
      return next
    })
    ensureSplitDraftForTransaction(transaction)
  }, [ensureSplitDraftForTransaction])

  const closeRuleModal = useCallback(() => {
    setRuleModalTransaction(null)
    setRuleModalError('')
    setRuleModalSubmitting(false)
  }, [])

  const openRuleModal = useCallback((transaction: TransactionRow) => {
    setRuleModalTransaction(transaction)
    const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id ?? ''
    setRuleForm({
      canonicalMerchant: detectCanonicalMerchant(transaction),
      matchType: 'equals',
      constrainToAccount: false,
      categoryId: effectiveCategoryId,
      applyScope: 'past_90_days',
    })
    setRuleModalError('')
  }, [])

  const createRuleFromTransaction = useCallback(async () => {
    if (!session?.user || !ruleModalTransaction) return

    const canonicalMerchant = ruleForm.canonicalMerchant.trim()
    if (!canonicalMerchant) {
      setRuleModalError('Merchant value is required.')
      return
    }
    if (!ruleForm.categoryId) {
      setRuleModalError('Choose a category before creating the rule.')
      return
    }

    setRuleModalError('')
    setRuleModalSubmitting(true)

    const ruleName = `Rule: ${canonicalMerchant}`
    const { data: insertedRule, error: insertRuleError } = await supabase
      .from('transaction_rules')
      .insert({
        user_id: session.user.id,
        name: ruleName,
        pattern: canonicalMerchant,
        match_type: ruleForm.matchType,
        account_id: ruleForm.constrainToAccount ? ruleModalTransaction.account_id : null,
        set_spending_category_id: ruleForm.categoryId,
        explanation: `Created from transaction ${ruleModalTransaction.id}.`,
        priority: 50,
        is_active: true,
      })
      .select('id')
      .single()

    if (insertRuleError || !insertedRule?.id) {
      captureException(insertRuleError ?? new Error('Missing inserted rule id'), {
        component: 'Transactions',
        action: 'create-rule-from-transaction',
        transaction_id: ruleModalTransaction.id,
      })
      setRuleModalError('Could not create rule.')
      setRuleModalSubmitting(false)
      return
    }

    const { data: updatedCount, error: applyRuleError } = await supabase.rpc('apply_rule', {
      rule_id: insertedRule.id,
      scope: ruleForm.applyScope,
    })

    if (applyRuleError) {
      captureException(applyRuleError, {
        component: 'Transactions',
        action: 'apply-created-rule',
        transaction_id: ruleModalTransaction.id,
        rule_id: insertedRule.id,
      })
      setRuleModalError('Rule was created, but applying it failed.')
      setRuleModalSubmitting(false)
      return
    }

    setToast({
      id: Date.now(),
      tone: 'info',
      message: `Rule created and applied. Updated ${Number(updatedCount ?? 0)} transaction(s).`,
    })
    setRuleModalSubmitting(false)
    closeRuleModal()
    setRefreshNonce((current) => current + 1)
  }, [closeRuleModal, ruleForm, ruleModalTransaction, session])

  const dismissCategoryFollowUpPrompt = useCallback(() => {
    setCategoryFollowUpPrompt(null)
  }, [])

  const toggleCategoryFollowUpAccountScope = useCallback((checked: boolean) => {
    setCategoryFollowUpPrompt((current) =>
      current ? { ...current, includeAccountScope: checked } : current,
    )
  }, [])

  const applyCategoryToSimilar = useCallback(async () => {
    if (!session?.user || !categoryFollowUpPrompt || categoryFollowUpPrompt.pendingAction) return

    const prompt = categoryFollowUpPrompt
    setCategoryFollowUpPrompt((current) =>
      current ? { ...current, pendingAction: 'apply_similar' } : current,
    )

    const { data, error: applyError } = await supabase.rpc('apply_category_to_similar', {
      merchant_canonical: prompt.merchantCanonical,
      account_id: prompt.includeAccountScope ? prompt.accountId : null,
      category_id: prompt.categoryId,
      lookback_days: 365,
    })

    if (applyError) {
      captureException(applyError, {
        component: 'Transactions',
        action: 'apply-category-to-similar',
        transaction_id: prompt.transactionId,
      })
      setToast({
        id: Date.now(),
        tone: 'error',
        message: 'Could not apply category to similar transactions.',
      })
      setCategoryFollowUpPrompt((current) =>
        current ? { ...current, pendingAction: null } : current,
      )
      return
    }

    setToast({
      id: Date.now(),
      tone: 'info',
      message: `Applied "${prompt.categoryName}" to ${Number(data ?? 0)} similar transaction(s).`,
    })
    setRefreshNonce((current) => current + 1)
    setCategoryFollowUpPrompt(null)
  }, [categoryFollowUpPrompt, session])


  const applyAndCreateRule = useCallback(async () => {
    if (!session?.user || !categoryFollowUpPrompt || categoryFollowUpPrompt.pendingAction) return

    const prompt = categoryFollowUpPrompt
    setCategoryFollowUpPrompt((current) =>
      current ? { ...current, pendingAction: 'apply_and_rule' } : current,
    )

    const [applyResult, ruleResult] = await Promise.all([
      supabase.rpc('apply_category_to_similar', {
        merchant_canonical: prompt.merchantCanonical,
        account_id: prompt.includeAccountScope ? prompt.accountId : null,
        category_id: prompt.categoryId,
        lookback_days: 365,
      }),
      supabase.from('transaction_rules').insert({
        user_id: session.user.id,
        name: `Auto category: ${prompt.merchantCanonical}`,
        pattern: prompt.merchantCanonical,
        match_type: 'contains',
        account_id: prompt.includeAccountScope ? prompt.accountId : null,
        set_spending_category_id: prompt.categoryId,
        set_pattern_classification: inferRecurringClassificationFromCategory(prompt.categoryName),
        explanation: `Created from manual category edit on transaction ${prompt.transactionId}.`,
        priority: 40,
        is_active: true,
      }),
    ])

    if (applyResult.error || ruleResult.error) {
      const err = applyResult.error ?? ruleResult.error
      captureException(err, {
        component: 'Transactions',
        action: 'apply-and-create-rule',
        transaction_id: prompt.transactionId,
      })
      setToast({
        id: Date.now(),
        tone: 'error',
        message: 'Could not apply category to all transactions.',
      })
      setCategoryFollowUpPrompt((current) =>
        current ? { ...current, pendingAction: null } : current,
      )
      return
    }

    // Fire-and-forget analysis run so the rule applies to any remaining transactions.
    // Intentionally no setRefreshNonce here - do not disrupt the user mid-categorization.
    fetchFunctionWithAuth('analysis-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch((analysisError) => {
      captureException(analysisError, {
        component: 'Transactions',
        action: 'auto-run-analysis-after-rule',
      })
    })

    setToast({
      id: Date.now(),
      tone: 'info',
      message: `Applied "${prompt.categoryName}" to ${Number(applyResult.data ?? 0)} past transaction(s) and saved rule for future ones. Analysis running in background -`,
      link: { href: '/subscriptions', label: 'check Recurring' },
    })
    setRefreshNonce((current) => current + 1)
    setCategoryFollowUpPrompt(null)
  }, [categoryFollowUpPrompt, session])

  // --- Hide transaction state & actions ---

  type HideFollowUpState = {
    transactionId: string
    merchantCanonical: string
    accountId: string
    includeAccountScope: boolean
    pending: boolean
  }
  const [hideFollowUp, setHideFollowUp] = useState<HideFollowUpState | null>(null)

  const hideTransaction = useCallback(async (transaction: TransactionRow) => {
    if (!session?.user) return
    const { error } = await supabase
      .from('transactions')
      .update({ is_hidden: true })
      .eq('id', transaction.id)
      .eq('user_id', session.user.id)
    if (error) {
      captureException(error, { component: 'Transactions', action: 'hide-transaction' })
      setToast({ id: Date.now(), tone: 'error', message: 'Could not hide transaction.' })
      return
    }
    setTransactions((current) => current.filter((t) => t.id !== transaction.id))
    setHideFollowUp({
      transactionId: transaction.id,
      merchantCanonical: transaction.merchant_canonical ?? transaction.merchant_normalized ?? transaction.description_short,
      accountId: transaction.account_id,
      includeAccountScope: false,
      pending: false,
    })
  }, [session])

  const hideEverywhereAndCreateRule = useCallback(async () => {
    if (!session?.user || !hideFollowUp || hideFollowUp.pending) return

    setHideFollowUp((current) => current ? { ...current, pending: true } : current)

    const [hideResult, ruleResult] = await Promise.all([
      supabase.rpc('hide_similar_transactions', {
        merchant_canonical: hideFollowUp.merchantCanonical,
        account_id: hideFollowUp.includeAccountScope ? hideFollowUp.accountId : null,
        lookback_days: 365,
      }),
      supabase.from('transaction_rules').insert({
        user_id: session.user.id,
        name: `Hide: ${hideFollowUp.merchantCanonical}`,
        pattern: hideFollowUp.merchantCanonical,
        match_type: 'contains',
        account_id: hideFollowUp.includeAccountScope ? hideFollowUp.accountId : null,
        set_is_hidden: true,
        explanation: `Created from hide action on transaction ${hideFollowUp.transactionId}.`,
        priority: 10,
        is_active: true,
      }),
    ])

    if (hideResult.error || ruleResult.error) {
      const err = hideResult.error ?? ruleResult.error
      captureException(err, { component: 'Transactions', action: 'hide-everywhere' })
      setToast({ id: Date.now(), tone: 'error', message: 'Could not hide all matching transactions.' })
      setHideFollowUp((current) => current ? { ...current, pending: false } : current)
      return
    }

    // Trigger analysis so the rule also applies to any remaining transactions
    fetchFunctionWithAuth('analysis-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch((err) => captureException(err, { component: 'Transactions', action: 'auto-run-analysis-after-hide' }))

    setToast({
      id: Date.now(),
      tone: 'info',
      message: `Hidden ${Number(hideResult.data ?? 0)} past transaction(s). Future matches will be hidden automatically.`,
    })
    setHideFollowUp(null)
    setRefreshNonce((current) => current + 1)
  }, [hideFollowUp, session])

  const addSplitLine = useCallback((transaction: TransactionRow) => {
    ensureSplitDraftForTransaction(transaction)
    setSplitDraftsByTransactionId((current) => {
      const existing = current[transaction.id] ?? []
      return {
        ...current,
        [transaction.id]: [
          ...existing,
          {
            draft_id: createSplitDraftId(),
            category_id: null,
            amount_input: '0.00',
            memo: '',
          },
        ],
      }
    })
  }, [ensureSplitDraftForTransaction])

  const updateSplitLine = useCallback(
    (
      transactionId: string,
      draftId: string,
      updates: Partial<Pick<TransactionSplitDraftLine, 'category_id' | 'amount_input' | 'memo'>>,
    ) => {
      setSplitDraftsByTransactionId((current) => {
        const existing = current[transactionId]
        if (!existing) return current
        return {
          ...current,
          [transactionId]: existing.map((line) => (line.draft_id === draftId ? { ...line, ...updates } : line)),
        }
      })
    },
    [],
  )

  const removeSplitLine = useCallback((transactionId: string, draftId: string) => {
    setSplitDraftsByTransactionId((current) => {
      const existing = current[transactionId]
      if (!existing || existing.length <= 1) return current
      return {
        ...current,
        [transactionId]: existing.filter((line) => line.draft_id !== draftId),
      }
    })
  }, [])

  const clearSplitDraft = useCallback(
    async (transaction: TransactionRow) => {
      if (!session?.user) return
      setSplitSavingIds((current) => {
        const next = new Set(current)
        next.add(transaction.id)
        return next
      })

      const { error: deleteError } = await supabase
        .from('transaction_splits')
        .delete()
        .eq('user_id', session.user.id)
        .eq('transaction_id', transaction.id)

      if (deleteError) {
        captureException(deleteError, {
          component: 'Transactions',
          action: 'clear-transaction-splits',
          transaction_id: transaction.id,
        })
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'Could not clear splits.',
        })
      } else {
        const defaultDraft = createSplitDraftFromRows(transaction, undefined)
        setSplitRowsByTransactionId((current) => ({ ...current, [transaction.id]: [] }))
        setSplitDraftsByTransactionId((current) => ({ ...current, [transaction.id]: defaultDraft }))
        setToast({
          id: Date.now(),
          tone: 'info',
          message: 'Splits cleared.',
        })
      }

      setSplitSavingIds((current) => {
        const next = new Set(current)
        next.delete(transaction.id)
        return next
      })
    },
    [createSplitDraftFromRows, session],
  )

  const saveSplitDraft = useCallback(
    async (transaction: TransactionRow) => {
      if (!session?.user) return
      const draftLines = splitDraftsByTransactionId[transaction.id] ?? []
      if (draftLines.length === 0) {
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'Add at least one split line before saving.',
        })
        return
      }

      const parsedLines = draftLines.map((line) => ({
        ...line,
        amount: parseAmountInput(line.amount_input),
      }))
      const invalidAmountLine = parsedLines.find((line) => !Number.isFinite(line.amount))
      if (invalidAmountLine) {
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'One or more split amounts are invalid.',
        })
        return
      }

      const transactionAmount = parseAmount(transaction.amount)
      const splitTotal = parsedLines.reduce((sum, line) => sum + line.amount, 0)
      if (!isSplitTotalValid(splitTotal, transactionAmount)) {
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'Split total must equal the original transaction amount.',
        })
        return
      }

      setSplitSavingIds((current) => {
        const next = new Set(current)
        next.add(transaction.id)
        return next
      })

      const { error: deleteError } = await supabase
        .from('transaction_splits')
        .delete()
        .eq('user_id', session.user.id)
        .eq('transaction_id', transaction.id)

      if (deleteError) {
        captureException(deleteError, {
          component: 'Transactions',
          action: 'replace-transaction-splits-delete-step',
          transaction_id: transaction.id,
        })
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'Could not save split lines.',
        })
        setSplitSavingIds((current) => {
          const next = new Set(current)
          next.delete(transaction.id)
          return next
        })
        return
      }

      const payload = parsedLines.map((line) => ({
        id: line.id ?? createSplitDraftId(),
        user_id: session.user.id,
        transaction_id: transaction.id,
        category_id: line.category_id,
        amount: line.amount,
        memo: line.memo.trim() || null,
      }))

      const { data: savedRows, error: upsertError } = await supabase
        .from('transaction_splits')
        .upsert(payload, { onConflict: 'id' })
        .select('id, transaction_id, category_id, amount, memo')

      if (upsertError) {
        captureException(upsertError, {
          component: 'Transactions',
          action: 'replace-transaction-splits-upsert-step',
          transaction_id: transaction.id,
        })
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'Could not save split lines.',
        })
      } else {
        const normalized = (savedRows ?? []) as TransactionSplitRow[]
        setSplitRowsByTransactionId((current) => ({ ...current, [transaction.id]: normalized }))
        setSplitDraftsByTransactionId((current) => ({
          ...current,
          [transaction.id]: createSplitDraftFromRows(transaction, normalized),
        }))
        setToast({
          id: Date.now(),
          tone: 'info',
          message: `Saved ${normalized.length} split line${normalized.length === 1 ? '' : 's'}.`,
        })
      }

      setSplitSavingIds((current) => {
        const next = new Set(current)
        next.delete(transaction.id)
        return next
      })
    },
    [createSplitDraftFromRows, session, splitDraftsByTransactionId],
  )

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!selectVisibleRef.current) return
    selectVisibleRef.current.indeterminate = someVisibleSelected
  }, [someVisibleSelected])

  useEffect(() => {
    keepOnlyVisible()
  }, [keepOnlyVisible])

  useEffect(() => {
    setExpandedTransactionIds((current) => {
      const visible = new Set(visibleTransactionIds)
      const next = new Set<string>()
      for (const transactionId of current) {
        if (visible.has(transactionId)) next.add(transactionId)
      }
      return next
    })
  }, [visibleTransactionIds])

  useEffect(() => {
    const loadFilterOptions = async () => {
      if (loading) return
      if (!session?.user) {
        navigate(getLoginRedirectPath(), { replace: true })
        return
      }

      try {
        setError('')

        const [accountsResult, categoriesResult] = await Promise.all([
          supabase
            .from('accounts')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('name', { ascending: true }),
          supabase
            .from('categories')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('name', { ascending: true }),
        ])

        if (accountsResult.error || categoriesResult.error) {
          captureException(accountsResult.error ?? categoriesResult.error, {
            component: 'Transactions',
            action: 'load-filter-options',
          })
          setError('Could not load transactions.')
          return
        }

        setAccounts((accountsResult.data ?? []) as AccountOption[])

        let nextCategories = (categoriesResult.data ?? []) as CategoryOption[]
        const hasSeededCategories = nextCategories.some(
          (category) => category.name.trim().toLowerCase() !== 'uncategorized',
        )

        if (!hasSeededCategories) {
          const seedResult = await supabase.rpc('seed_user_categories')
          if (seedResult.error) {
            captureException(seedResult.error, {
              component: 'Transactions',
              action: 'seed-user-categories',
            })

            const fallbackSeedResult = await supabase.from('categories').upsert(
              FALLBACK_CATEGORY_NAMES.map((name) => ({
                user_id: session.user.id,
                name,
              })),
              {
                onConflict: 'user_id,name',
                ignoreDuplicates: true,
              },
            )

            if (fallbackSeedResult.error) {
              captureException(fallbackSeedResult.error, {
                component: 'Transactions',
                action: 'seed-user-categories-fallback',
              })
            }
          } else {
            const refreshedCategoriesResult = await supabase
              .from('categories')
              .select('id, name')
              .eq('user_id', session.user.id)
              .order('name', { ascending: true })

            if (refreshedCategoriesResult.error) {
              captureException(refreshedCategoriesResult.error, {
                component: 'Transactions',
                action: 'reload-seeded-categories',
              })
            } else {
              nextCategories = (refreshedCategoriesResult.data ?? []) as CategoryOption[]
            }
          }

          const fallbackRefreshedCategoriesResult = await supabase
            .from('categories')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('name', { ascending: true })

          if (fallbackRefreshedCategoriesResult.error) {
            captureException(fallbackRefreshedCategoriesResult.error, {
              component: 'Transactions',
              action: 'reload-fallback-categories',
            })
          } else {
            nextCategories = (fallbackRefreshedCategoriesResult.data ?? []) as CategoryOption[]
          }
        }

        setCategories(nextCategories)
      } catch (error) {
        captureException(error, {
          component: 'Transactions',
          action: 'load-filter-options',
        })
        setError('Could not load transactions.')
      }
    }

    void loadFilterOptions()
  }, [loading, navigate, session])

  useEffect(() => {
    let active = true

    const loadTransactions = async () => {
      if (loading) return
      if (!session?.user) return

      try {
        setFetching(true)
        setError('')

        const from = (page - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        const searchQuery = search.trim().replace(/[(),]/g, ' ')

        let query = supabase
          .from('transactions')
          .select(
            'id, account_id, category_id, user_category_id, type, category, owner, category_source, rule_id, classification_rule_ref, posted_at, merchant_canonical, merchant_normalized, description_short, description_full, amount, currency, is_hidden, is_pending',
            { count: 'exact' },
          )
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .eq('is_hidden', showHidden)

        if (!showPending) {
          query = query.eq('is_pending', false)
        }

        if (viewPreset === 'elaine_income') {
          query = query.eq('owner', 'elaine').eq('type', 'income')
        } else if (viewPreset === 'household_bills') {
          query = query.eq('owner', 'household').eq('type', 'expense').eq('category', 'bill')
        } else if (viewPreset === 'brianna_savings') {
          query = query.eq('owner', 'brianna').in('type', ['transfer', 'savings'])
        }

        if (accountFilter) {
          query = query.eq('account_id', accountFilter)
        }

        if (startDate) {
          query = query.gte('posted_at', toStartOfDayIso(startDate))
        }

        if (endDate) {
          query = query.lte('posted_at', toEndOfDayIso(endDate))
        }

        const combinedFilter = buildSearchAndCategoryOrFilter(categoryFilter, searchQuery)
        if (combinedFilter) {
          query = query.or(combinedFilter)
        }

        let sortedQuery = query.order(sortColumn, {
          ascending: sortDirection === 'asc',
          nullsFirst: false,
        })

        if (sortColumn !== 'posted_at') {
          sortedQuery = sortedQuery.order('posted_at', { ascending: false, nullsFirst: false })
        }

        const { data, error: transactionsError, count } = await sortedQuery.range(from, to)

        if (!active) return

        if (transactionsError) {
          captureException(transactionsError, {
            component: 'Transactions',
            action: 'load-transactions',
          })
          setError('Could not load transactions.')
          setTransactions([])
          setSplitRowsByTransactionId({})
          setSplitDraftsByTransactionId({})
          setTotalCount(0)
          setFetching(false)
          return
        }

        const nextCount = count ?? 0
        const nextTotalPages = Math.max(1, Math.ceil(nextCount / PAGE_SIZE))
        if (page > nextTotalPages) {
          setPage(nextTotalPages)
          return
        }

        const nextTransactions = (data ?? []) as TransactionRow[]
        const nextSplitRowsByTransactionId: Record<string, TransactionSplitRow[]> = {}
        for (const transaction of nextTransactions) {
          nextSplitRowsByTransactionId[transaction.id] = []
        }

        if (nextTransactions.length > 0) {
          const transactionIds = nextTransactions.map((transaction) => transaction.id)
          const { data: splitRows, error: splitRowsError } = await supabase
            .from('transaction_splits')
            .select('id, transaction_id, category_id, amount, memo')
            .eq('user_id', session.user.id)
            .in('transaction_id', transactionIds)

          if (splitRowsError) {
            captureException(splitRowsError, {
              component: 'Transactions',
              action: 'load-transaction-splits',
            })
          } else {
            for (const splitRow of (splitRows ?? []) as TransactionSplitRow[]) {
              if (!nextSplitRowsByTransactionId[splitRow.transaction_id]) {
                nextSplitRowsByTransactionId[splitRow.transaction_id] = []
              }
              nextSplitRowsByTransactionId[splitRow.transaction_id].push(splitRow)
            }
          }
        }

        setTransactions(nextTransactions)
        setSplitRowsByTransactionId(nextSplitRowsByTransactionId)
        setSplitDraftsByTransactionId((current) => {
          const next = { ...current }
          for (const transaction of nextTransactions) {
            next[transaction.id] = createSplitDraftFromRows(
              transaction,
              nextSplitRowsByTransactionId[transaction.id],
            )
          }
          return next
        })
        setTotalCount(nextCount)
        setFetching(false)
      } catch (error) {
        if (!active) return
        captureException(error, {
          component: 'Transactions',
          action: 'load-transactions',
        })
        setError('Could not load transactions.')
        setTransactions([])
        setSplitRowsByTransactionId({})
        setSplitDraftsByTransactionId({})
        setTotalCount(0)
        setFetching(false)
      }
    }

    void loadTransactions()

    return () => {
      active = false
    }
  }, [accountFilter, categoryFilter, createSplitDraftFromRows, endDate, loading, page, refreshNonce, search, session, showHidden, showPending, sortColumn, sortDirection, startDate, viewPreset])

  const updateTransactionCategory = useCallback(
    async (txnId: string, nextValue: string) => {
      if (!session?.user) return

      const category_id = nextValue === UNCATEGORIZED_VALUE ? null : nextValue
      let previousCategoryId: string | null = null
      const targetTransaction = transactions.find((row) => row.id === txnId) ?? null

      setTransactions((current) =>
        current.map((row) => {
          if (row.id !== txnId) return row
          previousCategoryId = row.category_id
          return { ...row, category_id }
        }),
      )
      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        next.add(txnId)
        return next
      })

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ category_id })
        .eq('id', txnId)

      if (updateError) {
        captureException(updateError, {
          component: 'Transactions',
          action: 'update-transaction-category',
          transaction_id: txnId,
        })

        setTransactions((current) =>
          current.map((row) => (row.id === txnId ? { ...row, category_id: previousCategoryId } : row)),
        )
        setToast({
          id: Date.now(),
          tone: 'error',
          message: 'Could not update category. Changes were reverted.',
        })
      } else if (category_id && targetTransaction) {
        const merchantCanonical = detectCanonicalMerchant(targetTransaction)
        if (merchantCanonical) {
          setCategoryFollowUpPrompt({
            transactionId: targetTransaction.id,
            merchantCanonical,
            accountId: targetTransaction.account_id,
            categoryId: category_id,
            categoryName: categoryNameById.get(category_id) ?? 'Selected category',
            includeAccountScope: false,
            pendingAction: null,
          })
        }
      }

      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(txnId)
        return next
      })
    },
    [categoryNameById, session, transactions],
  )

  const createCategory = useCallback(async () => {
    if (!session?.user || !createCategoryForTxnId) return
    const name = createCategoryName.trim()
    if (!name) {
      setCreateCategoryError('Name is required.')
      return
    }
    setCreateCategorySubmitting(true)
    setCreateCategoryError('')

    const { data, error: insertError } = await supabase
      .from('categories')
      .insert({ user_id: session.user.id, name })
      .select('id, name')
      .single()

    if (insertError) {
      captureException(insertError, { component: 'Transactions', action: 'create-category' })
      setCreateCategoryError(
        insertError.code === '23505'
          ? 'A category with that name already exists.'
          : 'Could not create category.',
      )
      setCreateCategorySubmitting(false)
      return
    }

    const newCategory = data as CategoryOption
    setCategories((current) =>
      [...current, newCategory].sort((a, b) => a.name.localeCompare(b.name)),
    )
    const txnId = createCategoryForTxnId
    setCreateCategoryForTxnId(null)
    setCreateCategoryName('')
    setCreateCategorySubmitting(false)
    void updateTransactionCategory(txnId, newCategory.id)
  }, [createCategoryForTxnId, createCategoryName, session?.user, updateTransactionCategory])

  const applyBulkCategoryUpdate = useCallback(
    async (nextCategoryValue: string | null) => {
      if (!session?.user || selectedIdsArray.length === 0 || bulkUpdating) return

      const targetIds = [...selectedIdsArray]
      const targetIdSet = new Set(targetIds)
      const previousCategoryById = new Map<string, string | null>()
      const nextCategoryId = nextCategoryValue === UNCATEGORIZED_VALUE ? null : nextCategoryValue

      setBulkUpdating(true)
      setTransactions((current) =>
        current.map((row) => {
          if (!targetIdSet.has(row.id)) return row
          previousCategoryById.set(row.id, row.category_id)
          return { ...row, category_id: nextCategoryId }
        }),
      )
      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        for (const id of targetIds) next.add(id)
        return next
      })

      const { data: updatedRows, error: bulkUpdateError } = await supabase
        .from('transactions')
        .update({ category_id: nextCategoryId })
        .in('id', targetIds)
        .select('id')

      if (bulkUpdateError) {
        captureException(bulkUpdateError, {
          component: 'Transactions',
          action: 'bulk-update-transaction-category',
          transaction_count: String(targetIds.length),
        })
        setTransactions((current) =>
          current.map((row) =>
            targetIdSet.has(row.id)
              ? { ...row, category_id: previousCategoryById.get(row.id) ?? null }
              : row,
          ),
        )
        setToast({
          id: Date.now(),
          tone: 'error',
          message: `Bulk update failed for ${targetIds.length} transaction(s). Changes were reverted.`,
        })
      } else {
        const updatedIdSet = new Set((updatedRows ?? []).map((row) => row.id))
        const failedIds = targetIds.filter((id) => !updatedIdSet.has(id))

        if (failedIds.length > 0) {
          const failedSet = new Set(failedIds)
          setTransactions((current) =>
            current.map((row) =>
              failedSet.has(row.id)
                ? { ...row, category_id: previousCategoryById.get(row.id) ?? null }
                : row,
            ),
          )
          const idPreview = failedIds.slice(0, 5).join(', ')
          const suffix = failedIds.length > 5 ? ', ...' : ''
          setToast({
            id: Date.now(),
            tone: 'error',
            message: `Updated ${targetIds.length - failedIds.length}/${targetIds.length}. Failed IDs: ${idPreview}${suffix}`,
          })
          replaceSelection(failedIds)
        } else {
          clearSelection()
        }
      }

      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        for (const id of targetIds) next.delete(id)
        return next
      })
      setBulkUpdating(false)
    },
    [bulkUpdating, clearSelection, replaceSelection, selectedIdsArray, session],
  )

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 lg:space-y-6" aria-busy={fetching} data-testid="transactions-page">
      <section aria-labelledby="transactions-heading" className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 id="transactions-heading" className="text-2xl font-semibold text-foreground">
          Transactions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Filter and review synced transactions.</p>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Transaction views">
          {TRANSACTION_VIEW_PRESETS.map((preset) => {
            const isActive = viewPreset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleViewPresetChange(preset.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted/50 text-muted-foreground border border-border hover:bg-muted'
                }`}
                aria-pressed={isActive}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="transactions-start-date" className="sr-only">
              Start date
            </label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
              Start date
            </span>
            <input
              id="transactions-start-date"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-end-date" className="sr-only">
              End date
            </label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
              End date
            </span>
            <input
              id="transactions-end-date"
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-account-filter" className="sr-only">
              Account filter
            </label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
              Account
            </span>
            <select
              id="transactions-account-filter"
              value={accountFilter}
              onChange={handleAccountFilterChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-category-filter" className="sr-only">
              Category filter
            </label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
              Category
            </span>
            <select
              id="transactions-category-filter"
              value={categoryFilter}
              onChange={handleCategoryFilterChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All categories</option>
              <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-search-filter" className="sr-only">
              Search merchant or description
            </label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
              Search
            </span>
            <input
              id="transactions-search-filter"
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Merchant or description"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              <input
                type="checkbox"
                checked={showPending}
                onChange={(e) => { setShowPending(e.target.checked); setPage(1) }}
                className="rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Show pending
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => { setShowHidden(e.target.checked); setPage(1) }}
                className="rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Show hidden
            </label>
          </div>
        </div>

        {hasActiveFilters ? (
          <TransactionFilterChips
            chips={activeFilterChips}
            onRemoveChip={removeFilterChip}
            onClearAll={clearAllFilters}
          />
        ) : null}
      </section>

      <section
        aria-labelledby="transactions-results-heading"
        className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
      >
        <h2 id="transactions-results-heading" className="sr-only">
          Transaction results
        </h2>
        {fetching ? (
          <div className="p-4" aria-live="polite" aria-busy="true">
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-7 gap-4 border-b border bg-muted px-4 py-3">
                <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/20" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/20" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/20" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/20" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-7 gap-4 px-4 py-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-rose-600" role="alert" aria-live="polite">
            {error}
          </p>
        ) : (
          <div className="p-4" aria-live="polite">
            <p className="mb-3 text-sm text-muted-foreground" role="status">
              Showing {transactions.length} of {totalCount} transactions
            </p>
            {selectedCount > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{selectedCount} selected on this page</p>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={bulkUpdating}
                        className="inline-flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>Set category</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {categories.map((category) => (
                        <DropdownMenuItem
                          key={category.id}
                          onClick={() => void applyBulkCategoryUpdate(category.id)}
                          disabled={bulkUpdating}
                          className="truncate"
                        >
                          {category.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    onClick={() => void applyBulkCategoryUpdate(UNCATEGORIZED_VALUE)}
                    disabled={bulkUpdating}
                    className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear category
                  </button>
                </div>
              </div>
            )}
            {transactions.length === 0 ? (
              <div
                className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border bg-muted/30 px-4 text-center"
                role="status"
                aria-live="polite"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-muted-foreground/60" aria-hidden="true">
                  <path
                    d="M8 8h8M8 12h8M8 16h5M6 3h9l3 3v15H6z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-3 text-base font-medium text-foreground">No transactions match your filters</p>
                <p className="mt-1 text-sm text-muted-foreground">Try widening date range, account, category, or search.</p>
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input
                          ref={selectVisibleRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(event) => toggleAllVisible(event.target.checked)}
                          disabled={transactions.length === 0 || fetching || bulkUpdating}
                          aria-label="Select visible transactions"
                          className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSortChange('posted_at')}
                          className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                        >
                          Date
                          {sortColumn === 'posted_at' ? (sortDirection === 'asc' ? '^' : 'v') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSortChange('merchant_normalized')}
                          className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                        >
                          Merchant
                          {sortColumn === 'merchant_normalized' ? (sortDirection === 'asc' ? '^' : 'v') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSortChange('amount')}
                          className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                        >
                          Amount
                          {sortColumn === 'amount' ? (sortDirection === 'asc' ? '^' : 'v') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((transaction) => {
                      const amount = parseAmount(transaction.amount)
                      const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id
                      const categoryName = effectiveCategoryId ? categoryNameById.get(effectiveCategoryId) : null
                      const localCategoryValue = transaction.category_id ?? UNCATEGORIZED_VALUE
                      const isCategoryUpdating = categoryUpdatingIds.has(transaction.id)
                      const isExpanded = expandedTransactionIds.has(transaction.id)
                      const matchedRuleId = resolveRuleId(transaction)
                      const accountName = accountNameById.get(transaction.account_id) ?? 'Unknown account'
                      const rawMerchant = transaction.merchant_normalized ?? 'Not available'
                      const rawDescription = transaction.description_full ?? transaction.description_short ?? 'Not available'
                      const categorySource = transaction.category_source ?? null
                      const splitRows = splitRowsByTransactionId[transaction.id] ?? []
                      const splitCount = splitRows.length
                      const hasSplits = splitCount > 0
                      const splitDraft = splitDraftsByTransactionId[transaction.id] ?? []
                      const splitTotal = splitDraft.reduce((sum, line) => sum + parseAmountInput(line.amount_input), 0)
                      const splitBalanceDelta = amount - splitTotal
                      const splitValid = isSplitTotalValid(splitTotal, amount)
                      const isSplitSaving = splitSavingIds.has(transaction.id)

                      return [
                        <tr key={`${transaction.id}-row`} className="hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected(transaction.id)}
                              onChange={(event) => toggleOne(transaction.id, event.target.checked)}
                              disabled={isCategoryUpdating || bulkUpdating}
                              aria-label={`Select transaction ${transaction.id}`}
                              className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(transaction.posted_at), 'yyyy-MM-dd')}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {transaction.merchant_normalized || accountNameById.get(transaction.account_id) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{transaction.description_short}</td>
                          <td
                            className={`px-4 py-3 ${amount < 0 ? 'font-medium text-emerald-600' : 'text-foreground'}`}
                          >
                            {amount.toLocaleString(undefined, {
                              style: 'currency',
                              currency: transaction.currency || 'USD',
                            })}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {hasSplits ? (
                              <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                Split ({splitCount})
                              </span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isCategoryUpdating || bulkUpdating}
                                    className="inline-flex min-w-[11rem] items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={`Edit category for ${transaction.description_short}`}
                                  >
                                    <span className="truncate">{categoryName ?? 'Uncategorized'}</span>
                                    {isCategoryUpdating ? (
                                      <span className="text-xs text-muted-foreground">Saving...</span>
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                  <DropdownMenuRadioGroup
                                    value={localCategoryValue}
                                    onValueChange={(value: string) => {
                                      if (value === localCategoryValue || isCategoryUpdating || bulkUpdating) return
                                      void updateTransactionCategory(transaction.id, value)
                                    }}
                                  >
                                    <DropdownMenuRadioItem value={UNCATEGORIZED_VALUE}>
                                      <div className="flex w-full items-center justify-between">
                                        <span>Uncategorized</span>
                                        {localCategoryValue === UNCATEGORIZED_VALUE && <Check className="h-3.5 w-3.5" />}
                                      </div>
                                    </DropdownMenuRadioItem>
                                    {categories.map((category) => (
                                      <DropdownMenuRadioItem key={category.id} value={category.id}>
                                        <div className="flex w-full items-center justify-between gap-3">
                                          <span className="truncate">{category.name}</span>
                                          {localCategoryValue === category.id && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setCreateCategoryForTxnId(transaction.id)
                                      setCreateCategoryName('')
                                      setCreateCategoryError('')
                                    }}
                                    className="text-primary"
                                  >
                                    + New category...
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleTransactionDetails(transaction)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-expanded={isExpanded}
                              aria-controls={`transaction-details-${transaction.id}`}
                            >
                              {isExpanded ? 'Hide' : 'Show'}
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                        </tr>,
                        isExpanded ? (
                          <tr
                            key={`${transaction.id}-details`}
                            id={`transaction-details-${transaction.id}`}
                            className="bg-muted/20"
                          >
                            <td colSpan={7} className="px-4 pb-4 pt-0">
                              <div className="mt-1 rounded-lg border border-border bg-muted/30 p-4">
                                <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Raw merchant
                                    </p>
                                    <p className="mt-1 break-words text-foreground">{rawMerchant}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Raw description
                                    </p>
                                    <p className="mt-1 break-words text-foreground">{rawDescription}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Account
                                    </p>
                                    <p className="mt-1 break-words text-foreground">{accountName}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Amount
                                    </p>
                                    <p className={`mt-1 ${amount < 0 ? 'font-medium text-emerald-600' : 'text-foreground'}`}>
                                      {amount.toLocaleString(undefined, {
                                        style: 'currency',
                                        currency: transaction.currency || 'USD',
                                      })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Date
                                    </p>
                                    <p className="mt-1 text-foreground">
                                      {format(new Date(transaction.posted_at), 'yyyy-MM-dd HH:mm')}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Category source
                                    </p>
                                    <p className="mt-1 text-foreground">{categorySource ?? 'Not available'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Category
                                    </p>
                                    <p className="mt-1 text-foreground">{categoryName ?? 'Uncategorized'}</p>
                                  </div>
                                  <div className="md:col-span-2 xl:col-span-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Matched rule
                                    </p>
                                    {matchedRuleId ? (
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="text-foreground">Rule {matchedRuleId}</span>
                                        <Link
                                          to={`/rules?ruleId=${matchedRuleId}`}
                                          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                                        >
                                          Open in Rules
                                        </Link>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-foreground">No matched rule</p>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border pt-3">
                                  <div className="space-y-1">
                                    <label
                                      htmlFor={`transaction-detail-category-${transaction.id}`}
                                      className="text-xs font-medium text-muted-foreground"
                                    >
                                      Edit category
                                    </label>
                                    <select
                                      id={`transaction-detail-category-${transaction.id}`}
                                      value={localCategoryValue}
                                      disabled={isCategoryUpdating || bulkUpdating}
                                      onChange={(event) => {
                                        const value = event.target.value
                                        if (value === localCategoryValue || isCategoryUpdating || bulkUpdating) return
                                        void updateTransactionCategory(transaction.id, value)
                                      }}
                                      className="min-w-[12rem] rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
                                      {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                          {category.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => openRuleModal(transaction)}
                                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    Create rule from this transaction
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void hideTransaction(transaction)}
                                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    Hide this transaction
                                  </button>
                                </div>

                                <div className="mt-4 space-y-3 border-t border pt-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Split transaction</p>
                                      <p className="text-xs text-muted-foreground">
                                        Split total must equal original amount.
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${splitValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        Total {splitTotal.toLocaleString(undefined, {
                                          style: 'currency',
                                          currency: transaction.currency || 'USD',
                                        })}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Delta {splitBalanceDelta.toLocaleString(undefined, {
                                          style: 'currency',
                                          currency: transaction.currency || 'USD',
                                        })}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    {splitDraft.map((line) => (
                                      <div
                                        key={line.draft_id}
                                        className="grid gap-2 rounded-md border border-border bg-card p-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto]"
                                      >
                                        <div>
                                          <label
                                            htmlFor={`split-category-${transaction.id}-${line.draft_id}`}
                                            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                                          >
                                            Category
                                          </label>
                                          <select
                                            id={`split-category-${transaction.id}-${line.draft_id}`}
                                            value={line.category_id ?? UNCATEGORIZED_VALUE}
                                            disabled={isSplitSaving}
                                            onChange={(event) => {
                                              const next = event.target.value
                                              updateSplitLine(transaction.id, line.draft_id, {
                                                category_id: next === UNCATEGORIZED_VALUE ? null : next,
                                              })
                                            }}
                                            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
                                            {categories.map((category) => (
                                              <option key={category.id} value={category.id}>
                                                {category.name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label
                                            htmlFor={`split-amount-${transaction.id}-${line.draft_id}`}
                                            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                                          >
                                            Amount
                                          </label>
                                          <input
                                            id={`split-amount-${transaction.id}-${line.draft_id}`}
                                            type="number"
                                            step="0.01"
                                            value={line.amount_input}
                                            disabled={isSplitSaving}
                                            onChange={(event) =>
                                              updateSplitLine(transaction.id, line.draft_id, {
                                                amount_input: event.target.value,
                                              })}
                                            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          />
                                        </div>

                                        <div>
                                          <label
                                            htmlFor={`split-memo-${transaction.id}-${line.draft_id}`}
                                            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                                          >
                                            Memo
                                          </label>
                                          <input
                                            id={`split-memo-${transaction.id}-${line.draft_id}`}
                                            type="text"
                                            value={line.memo}
                                            disabled={isSplitSaving}
                                            onChange={(event) =>
                                              updateSplitLine(transaction.id, line.draft_id, {
                                                memo: event.target.value,
                                              })}
                                            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          />
                                        </div>

                                        <div className="flex items-end">
                                          <button
                                            type="button"
                                            disabled={isSplitSaving || splitDraft.length <= 1}
                                            onClick={() => removeSplitLine(transaction.id, line.draft_id)}
                                            className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => addSplitLine(transaction)}
                                      disabled={isSplitSaving}
                                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Add split line
                                    </button>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {hasSplits ? (
                                        <button
                                          type="button"
                                          onClick={() => void clearSplitDraft(transaction)}
                                          disabled={isSplitSaving}
                                          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Clear splits
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => void saveSplitDraft(transaction)}
                                        disabled={isSplitSaving || !splitValid}
                                        className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {isSplitSaving ? 'Saving...' : 'Save splits'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ]
                    })}
                  </tbody>
                </table>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border pt-3">
                  <p className="text-sm text-muted-foreground">
                    Page {Math.min(page, totalPages)} of {totalPages}
                  </p>
                  <nav className="flex items-center gap-2" aria-label="Transactions pagination">
                    <button
                      type="button"
                      onClick={handlePreviousPage}
                      disabled={fetching || !hasPreviousPage || bulkUpdating}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={fetching || !hasNextPage || bulkUpdating}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {ruleModalTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-transaction-rule-title"
        >
          <div className="my-4 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl sm:my-0">
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
                  {ruleModalTransaction.merchant_normalized ?? ruleModalTransaction.description_short}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</dt>
                <dd className="mt-1 text-foreground">
                  {parseAmount(ruleModalTransaction.amount).toLocaleString(undefined, {
                    style: 'currency',
                    currency: ruleModalTransaction.currency || 'USD',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</dt>
                <dd className="mt-1 text-foreground">
                  {format(new Date(ruleModalTransaction.posted_at), 'yyyy-MM-dd HH:mm')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</dt>
                <dd className="mt-1 text-foreground">
                  {ruleModalTransaction.description_full ?? ruleModalTransaction.description_short}
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
                  id="create-rule-canonical-merchant"
                  type="text"
                  value={ruleForm.canonicalMerchant}
                  disabled={ruleModalSubmitting}
                  onChange={(event) =>
                    setRuleForm((current) => ({ ...current, canonicalMerchant: event.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Match type</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={ruleModalSubmitting}
                    onClick={() => setRuleForm((current) => ({ ...current, matchType: 'equals' }))}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                      ruleForm.matchType === 'equals'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border text-foreground hover:bg-muted'
                    }`}
                  >
                    Equals
                  </button>
                  <button
                    type="button"
                    disabled={ruleModalSubmitting}
                    onClick={() => setRuleForm((current) => ({ ...current, matchType: 'contains' }))}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                      ruleForm.matchType === 'contains'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border text-foreground hover:bg-muted'
                    }`}
                  >
                    Contains
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Apply scope</p>
                <select
                  value={ruleForm.applyScope}
                  disabled={ruleModalSubmitting}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      applyScope: event.target.value as RuleApplyScope,
                    }))
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
                  onChange={(event) =>
                    setRuleForm((current) => ({ ...current, categoryId: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      constrainToAccount: event.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span>
                  Restrict to this account
                  <span className="block text-xs text-muted-foreground">
                    {accountNameById.get(ruleModalTransaction.account_id) ?? 'Current account'}
                  </span>
                </span>
              </label>
            </div>

            {ruleModalError ? (
              <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {ruleModalError}
              </div>
            ) : null}

            <div className="sticky bottom-0 mt-5 flex flex-wrap justify-end gap-2 border-t border bg-card pt-4">
              <button
                type="button"
                disabled={ruleModalSubmitting}
                onClick={closeRuleModal}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={ruleModalSubmitting}
                onClick={() => void createRuleFromTransaction()}
                className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ruleModalSubmitting ? 'Saving...' : 'Create rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryFollowUpPrompt && (
        <div
          className="fixed bottom-4 left-4 z-50 w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-foreground">Apply to similar past transactions?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Apply <span className="font-medium text-foreground">{categoryFollowUpPrompt.categoryName}</span> to
            matching <span className="font-medium text-foreground">{categoryFollowUpPrompt.merchantCanonical}</span>{' '}
            transactions in the last 12 months.
          </p>

          <label className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={categoryFollowUpPrompt.includeAccountScope}
              disabled={categoryFollowUpPrompt.pendingAction !== null}
              onChange={(event) => toggleCategoryFollowUpAccountScope(event.target.checked)}
              className="mt-0.5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>
              Only this account
              <span className="block text-xs text-muted-foreground">
                {accountNameById.get(categoryFollowUpPrompt.accountId) ?? 'Current account'}
              </span>
            </span>
          </label>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={categoryFollowUpPrompt.pendingAction !== null}
              onClick={dismissCategoryFollowUpPrompt}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              Dismiss
            </button>
            <button
              type="button"
              disabled={categoryFollowUpPrompt.pendingAction !== null}
              onClick={() => void applyCategoryToSimilar()}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {categoryFollowUpPrompt.pendingAction === 'apply_similar'
                ? 'Applying...'
                : 'Past only'}
            </button>
            <button
              type="button"
              disabled={categoryFollowUpPrompt.pendingAction !== null}
              onClick={() => void applyAndCreateRule()}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {categoryFollowUpPrompt.pendingAction === 'apply_and_rule'
                ? 'Applying...'
                : 'Fix everywhere (past + future)'}
            </button>
          </div>
        </div>
      )}

      {hideFollowUp && (
        <div
          className="fixed bottom-4 left-4 z-50 w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-foreground">Hide all matching transactions?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hide all past <span className="font-medium text-foreground">{hideFollowUp.merchantCanonical}</span>{' '}
            transactions and create a rule to auto-hide future ones.
          </p>
          <label className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={hideFollowUp.includeAccountScope}
              disabled={hideFollowUp.pending}
              onChange={(e) => setHideFollowUp((current) => current ? { ...current, includeAccountScope: e.target.checked } : current)}
              className="mt-0.5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>Only this account</span>
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={hideFollowUp.pending}
              onClick={() => setHideFollowUp(null)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              Just this one
            </button>
            <button
              type="button"
              disabled={hideFollowUp.pending}
              onClick={() => void hideEverywhereAndCreateRule()}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {hideFollowUp.pending ? 'Hiding...' : 'Hide everywhere (past + future)'}
            </button>
          </div>
        </div>
      )}

      {createCategoryForTxnId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-category-title"
        >
          <div className="w-full max-w-sm rounded-xl border border bg-card p-5 shadow-xl">
            <h3 id="create-category-title" className="text-lg font-semibold text-foreground">
              New category
            </h3>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void createCategory()
              }}
            >
              <input
                autoFocus
                type="text"
                value={createCategoryName}
                onChange={(e) => setCreateCategoryName(e.target.value)}
                placeholder="Category name"
                disabled={createCategorySubmitting}
                className="w-full rounded-md border border px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              {createCategoryError && (
                <p className="text-sm text-rose-600">{createCategoryError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={createCategorySubmitting}
                  onClick={() => {
                    setCreateCategoryForTxnId(null)
                    setCreateCategoryName('')
                    setCreateCategoryError('')
                  }}
                  className="rounded-md border border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategorySubmitting || !createCategoryName.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createCategorySubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.tone === 'error'
              ? 'border border-rose-300 bg-rose-50 text-rose-700'
              : 'border border-primary/30 bg-primary/10 text-primary'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
          {toast.link && (
            <Link to={toast.link.href} className="ml-1 underline font-medium" onClick={() => setToast(null)}>
              {toast.link.label}
            </Link>
          )}
        </div>
      )}
    </main>
  )
}

