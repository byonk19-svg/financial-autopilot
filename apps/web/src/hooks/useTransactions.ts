import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { captureException } from '@/lib/errorReporting'
import { fetchFunctionWithAuth } from '@/lib/fetchWithAuth'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { inferRecurringClassificationFromCategory } from '@/lib/categoryRules'
import { useTransactionFilterChips } from '@/hooks/useTransactionFilterChips'
import { useTransactionSelection } from '@/hooks/useTransactionSelection'
import type {
  AccountOption,
  CategoryOption,
  CategoryFollowUpPromptState,
  CreateRuleFormState,
  HideFollowUpState,
  OwnerValue,
  SortColumn,
  SortDirection,
  TransactionRow,
  TransactionSplitDraftLine,
  TransactionSplitRow,
  TransactionToast,
  TransactionViewPreset,
} from '@/lib/types'

// ─── exported constants (page JSX uses these) ────────────────────────────────

export const UNCATEGORIZED_VALUE = '__uncategorized__'

export const TRANSACTION_VIEW_PRESETS: Array<{ value: TransactionViewPreset; label: string }> = [
  { value: 'all', label: 'All Transactions' },
  { value: 'elaine_income', label: "Elaine's Income" },
  { value: 'household_bills', label: 'Household Bills' },
  { value: 'brianna_savings', label: "Brianna's Savings" },
]

// ─── exported utility functions (page JSX uses these) ────────────────────────

export function parseAmount(value: number | string): number {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function resolveRuleId(transaction: TransactionRow): string | null {
  if (transaction.rule_id) return transaction.rule_id
  const ref = transaction.classification_rule_ref
  if (!ref) return null
  const prefix = 'transaction_rule:'
  if (!ref.startsWith(prefix)) return null
  const possibleId = ref.slice(prefix.length)
  return possibleId.length > 0 ? possibleId : null
}

export function parseAmountInput(value: string): number {
  const parsed = Number.parseFloat(value.trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function isSplitTotalValid(total: number, amount: number): boolean {
  return Math.abs(total - amount) < 0.005
}

// ─── private constants ────────────────────────────────────────────────────────

const PAGE_SIZE = 50

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

const TRANSACTION_VIEW_PRESET_LABELS: Record<Exclude<TransactionViewPreset, 'all'>, string> = {
  elaine_income: "View: Elaine's Income",
  household_bills: 'View: Household Bills',
  brianna_savings: "View: Brianna's Savings",
}

// ─── private utility functions ────────────────────────────────────────────────

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
    categoryPredicates = [
      `user_category_id.eq.${categoryId}`,
      `and(user_category_id.is.null,category_id.eq.${categoryId})`,
    ]
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
        searchPredicates.map((searchPredicate) => `and(${categoryPredicate},${searchPredicate})`),
      )
      .join(',')
  }

  if (categoryPredicates.length) return categoryPredicates.join(',')
  if (searchPredicates.length) return searchPredicates.join(',')
  return null
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

function isDuplicateAutoRuleError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').includes('uq_transaction_category_rules_v1_signature')
}

function isDuplicateOwnerAutoRuleError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').includes('uq_transaction_owner_rules_v1_signature')
}

function isOwnerRuleTarget(owner: OwnerValue | undefined): owner is Exclude<OwnerValue, 'unknown'> {
  return owner === 'brianna' || owner === 'elaine' || owner === 'household'
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useTransactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useSession()

  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [categoryUpdatingIds, setCategoryUpdatingIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [toast, setToast] = useState<TransactionToast | null>(null)
  const [categoryFollowUpPrompt, setCategoryFollowUpPrompt] =
    useState<CategoryFollowUpPromptState | null>(null)
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
  const [splitRowsByTransactionId, setSplitRowsByTransactionId] = useState<
    Record<string, TransactionSplitRow[]>
  >({})
  const [splitDraftsByTransactionId, setSplitDraftsByTransactionId] = useState<
    Record<string, TransactionSplitDraftLine[]>
  >({})
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
  const [hideFollowUp, setHideFollowUp] = useState<HideFollowUpState | null>(null)
  const selectVisibleRef = useRef<HTMLInputElement>(null)

  // ── derived ────────────────────────────────────────────────────────────────

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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount])
  const hasPreviousPage = page > 1
  const hasNextPage = page < totalPages
  const visibleTransactionIds = useMemo(
    () => transactions.map((t) => t.id),
    [transactions],
  )

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

  // ── effects ────────────────────────────────────────────────────────────────

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
      for (const id of current) {
        if (visible.has(id)) next.add(id)
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
              FALLBACK_CATEGORY_NAMES.map((name) => ({ user_id: session.user.id, name })),
              { onConflict: 'user_id,name', ignoreDuplicates: true },
            )

            if (fallbackSeedResult.error) {
              captureException(fallbackSeedResult.error, {
                component: 'Transactions',
                action: 'seed-user-categories-fallback',
              })
            }
          } else {
            const refreshedResult = await supabase
              .from('categories')
              .select('id, name')
              .eq('user_id', session.user.id)
              .order('name', { ascending: true })

            if (refreshedResult.error) {
              captureException(refreshedResult.error, {
                component: 'Transactions',
                action: 'reload-seeded-categories',
              })
            } else {
              nextCategories = (refreshedResult.data ?? []) as CategoryOption[]
            }
          }

          const fallbackRefreshed = await supabase
            .from('categories')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('name', { ascending: true })

          if (fallbackRefreshed.error) {
            captureException(fallbackRefreshed.error, {
              component: 'Transactions',
              action: 'reload-fallback-categories',
            })
          } else {
            nextCategories = (fallbackRefreshed.data ?? []) as CategoryOption[]
          }
        }

        setCategories(nextCategories)
      } catch (err) {
        captureException(err, { component: 'Transactions', action: 'load-filter-options' })
        setError('Could not load transactions.')
      }
    }

    void loadFilterOptions()
  }, [loading, navigate, session])

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

        if (!showPending) query = query.eq('is_pending', false)

        if (viewPreset === 'elaine_income') {
          query = query.eq('owner', 'elaine').eq('type', 'income')
        } else if (viewPreset === 'household_bills') {
          query = query.eq('owner', 'household').eq('type', 'expense').eq('category', 'bill')
        } else if (viewPreset === 'brianna_savings') {
          query = query.eq('owner', 'brianna').in('type', ['transfer', 'savings'])
        }

        if (accountFilter) query = query.eq('account_id', accountFilter)
        if (startDate) query = query.gte('posted_at', toStartOfDayIso(startDate))
        if (endDate) query = query.lte('posted_at', toEndOfDayIso(endDate))

        const combinedFilter = buildSearchAndCategoryOrFilter(categoryFilter, searchQuery)
        if (combinedFilter) query = query.or(combinedFilter)

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
          captureException(transactionsError, { component: 'Transactions', action: 'load-transactions' })
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
          const transactionIds = nextTransactions.map((t) => t.id)
          const { data: splitRows, error: splitRowsError } = await supabase
            .from('transaction_splits')
            .select('id, transaction_id, category_id, amount, memo')
            .eq('user_id', session.user.id)
            .in('transaction_id', transactionIds)

          if (splitRowsError) {
            captureException(splitRowsError, { component: 'Transactions', action: 'load-transaction-splits' })
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
      } catch (err) {
        if (!active) return
        captureException(err, { component: 'Transactions', action: 'load-transactions' })
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
  }, [
    accountFilter,
    categoryFilter,
    createSplitDraftFromRows,
    endDate,
    loading,
    page,
    refreshNonce,
    search,
    session,
    showHidden,
    showPending,
    sortColumn,
    sortDirection,
    startDate,
    viewPreset,
  ])

  // ── filter handlers ────────────────────────────────────────────────────────

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
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'))
        return currentColumn
      }
      setSortDirection(column === 'merchant_normalized' ? 'asc' : 'desc')
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

  const removeFilterChip = useCallback(
    (key: 'view' | 'date_range' | 'account' | 'category' | 'search') => {
      if (key === 'view') setViewPreset('all')
      else if (key === 'date_range') { setStartDate(''); setEndDate('') }
      else if (key === 'account') setAccountFilter('')
      else if (key === 'category') setCategoryFilter('')
      else if (key === 'search') setSearch('')
      setPage(1)
    },
    [],
  )

  // ── split handlers ─────────────────────────────────────────────────────────

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

  const toggleTransactionDetails = useCallback(
    (transaction: TransactionRow) => {
      setExpandedTransactionIds((current) => {
        const next = new Set(current)
        if (next.has(transaction.id)) next.delete(transaction.id)
        else next.add(transaction.id)
        return next
      })
      ensureSplitDraftForTransaction(transaction)
    },
    [ensureSplitDraftForTransaction],
  )

  const addSplitLine = useCallback(
    (transaction: TransactionRow) => {
      ensureSplitDraftForTransaction(transaction)
      setSplitDraftsByTransactionId((current) => {
        const existing = current[transaction.id] ?? []
        return {
          ...current,
          [transaction.id]: [
            ...existing,
            { draft_id: createSplitDraftId(), category_id: null, amount_input: '0.00', memo: '' },
          ],
        }
      })
    },
    [ensureSplitDraftForTransaction],
  )

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
          [transactionId]: existing.map((line) =>
            line.draft_id === draftId ? { ...line, ...updates } : line,
          ),
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
      setSplitSavingIds((current) => new Set(current).add(transaction.id))

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
        setToast({ id: Date.now(), tone: 'error', message: 'Could not clear splits.' })
      } else {
        const defaultDraft = createSplitDraftFromRows(transaction, undefined)
        setSplitRowsByTransactionId((current) => ({ ...current, [transaction.id]: [] }))
        setSplitDraftsByTransactionId((current) => ({ ...current, [transaction.id]: defaultDraft }))
        setToast({ id: Date.now(), tone: 'info', message: 'Splits cleared.' })
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
        setToast({ id: Date.now(), tone: 'error', message: 'Add at least one split line before saving.' })
        return
      }

      const parsedLines = draftLines.map((line) => ({ ...line, amount: parseAmountInput(line.amount_input) }))
      const invalidAmountLine = parsedLines.find((line) => !Number.isFinite(line.amount))
      if (invalidAmountLine) {
        setToast({ id: Date.now(), tone: 'error', message: 'One or more split amounts are invalid.' })
        return
      }

      const transactionAmount = parseAmount(transaction.amount)
      const splitTotal = parsedLines.reduce((sum, line) => sum + line.amount, 0)
      if (!isSplitTotalValid(splitTotal, transactionAmount)) {
        setToast({ id: Date.now(), tone: 'error', message: 'Split total must equal the original transaction amount.' })
        return
      }

      setSplitSavingIds((current) => new Set(current).add(transaction.id))

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
        setToast({ id: Date.now(), tone: 'error', message: 'Could not save split lines.' })
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
        setToast({ id: Date.now(), tone: 'error', message: 'Could not save split lines.' })
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

  // ── rule modal ────────────────────────────────────────────────────────────

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

    const { data: insertedRule, error: insertRuleError } = await supabase
      .from('transaction_rules')
      .insert({
        user_id: session.user.id,
        name: `Rule: ${canonicalMerchant}`,
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

  // ── category follow-up ────────────────────────────────────────────────────

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
      setToast({ id: Date.now(), tone: 'error', message: 'Could not apply category to similar transactions.' })
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
    const merchantPattern = prompt.merchantCanonical.trim()
    const sourceTransaction = transactions.find((transaction) => transaction.id === prompt.transactionId) ?? null
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
      setToast({ id: Date.now(), tone: 'error', message: 'Could not apply category to all transactions.' })
      setCategoryFollowUpPrompt((current) =>
        current ? { ...current, pendingAction: null } : current,
      )
      return
    }

    let syncRuleWarning = ''
    let ownerRuleWarning = ''
    if (merchantPattern.length > 0) {
      const syncRuleType = prompt.includeAccountScope ? 'merchant_contains_account' : 'merchant_contains'
      const { error: syncRuleError } = await supabase.from('transaction_category_rules_v1').insert({
        user_id: session.user.id,
        rule_type: syncRuleType,
        merchant_pattern: merchantPattern,
        account_id: prompt.includeAccountScope ? prompt.accountId : null,
        min_amount: null,
        max_amount: null,
        category_id: prompt.categoryId,
        is_active: true,
      })

      if (syncRuleError && !isDuplicateAutoRuleError(syncRuleError)) {
        captureException(syncRuleError, {
          component: 'Transactions',
          action: 'create-sync-time-category-rule',
          transaction_id: prompt.transactionId,
        })
        syncRuleWarning = ' Sync-time rule save failed; check Auto Rules.'
      }

      if (sourceTransaction && isOwnerRuleTarget(sourceTransaction.owner)) {
        const { error: ownerRuleError } = await supabase.from('transaction_owner_rules_v1').insert({
          user_id: session.user.id,
          rule_type: syncRuleType,
          merchant_pattern: merchantPattern,
          account_id: prompt.includeAccountScope ? prompt.accountId : null,
          min_amount: null,
          max_amount: null,
          set_owner: sourceTransaction.owner,
          is_active: true,
        })

        if (ownerRuleError && !isDuplicateOwnerAutoRuleError(ownerRuleError)) {
          captureException(ownerRuleError, {
            component: 'Transactions',
            action: 'create-sync-time-owner-rule',
            transaction_id: prompt.transactionId,
          })
          ownerRuleWarning = ' Owner auto-rule save failed; check Auto Rules.'
        }
      }
    } else {
      syncRuleWarning = ' Sync-time rule skipped (missing merchant pattern).'
    }

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
      message: `Applied "${prompt.categoryName}" to ${Number(applyResult.data ?? 0)} past transaction(s) and saved future auto-categorization rules.${syncRuleWarning}${ownerRuleWarning} Analysis running in background -`,
      link: { href: '/subscriptions', label: 'check Recurring' },
    })
    setRefreshNonce((current) => current + 1)
    setCategoryFollowUpPrompt(null)
  }, [categoryFollowUpPrompt, session, transactions])

  // ── hide follow-up ────────────────────────────────────────────────────────

  const hideTransaction = useCallback(
    async (transaction: TransactionRow) => {
      if (!session?.user) return
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ is_hidden: true })
        .eq('id', transaction.id)
        .eq('user_id', session.user.id)
      if (updateError) {
        captureException(updateError, { component: 'Transactions', action: 'hide-transaction' })
        setToast({ id: Date.now(), tone: 'error', message: 'Could not hide transaction.' })
        return
      }
      setTransactions((current) => current.filter((t) => t.id !== transaction.id))
      setHideFollowUp({
        transactionId: transaction.id,
        merchantCanonical:
          transaction.merchant_canonical ??
          transaction.merchant_normalized ??
          transaction.description_short,
        accountId: transaction.account_id,
        includeAccountScope: false,
        pending: false,
      })
    },
    [session],
  )

  const hideEverywhereAndCreateRule = useCallback(async () => {
    if (!session?.user || !hideFollowUp || hideFollowUp.pending) return

    setHideFollowUp((current) => (current ? { ...current, pending: true } : current))

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
      setHideFollowUp((current) => (current ? { ...current, pending: false } : current))
      return
    }

    fetchFunctionWithAuth('analysis-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch((err) =>
      captureException(err, { component: 'Transactions', action: 'auto-run-analysis-after-hide' }),
    )

    setToast({
      id: Date.now(),
      tone: 'info',
      message: `Hidden ${Number(hideResult.data ?? 0)} past transaction(s). Future matches will be hidden automatically.`,
    })
    setHideFollowUp(null)
    setRefreshNonce((current) => current + 1)
  }, [hideFollowUp, session])

  // ── transaction mutations ──────────────────────────────────────────────────

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
        setToast({ id: Date.now(), tone: 'error', message: 'Could not update category. Changes were reverted.' })
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

    const newCategory = data as AccountOption
    setCategories((current) => [...current, newCategory].sort((a, b) => a.name.localeCompare(b.name)))
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

  // ── return ─────────────────────────────────────────────────────────────────

  return {
    // data
    accounts,
    categories,
    transactions,
    fetching,
    error,
    toast,
    setToast,
    // pagination
    page,
    totalCount,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    // sort/filter state
    sortColumn,
    sortDirection,
    viewPreset,
    startDate,
    endDate,
    accountFilter,
    categoryFilter,
    showPending,
    setShowPending,
    showHidden,
    setShowHidden,
    search,
    // derived maps
    accountNameById,
    categoryNameById,
    // filter chips
    activeFilterChips,
    hasActiveFilters,
    // selection
    allVisibleSelected,
    selectedCount,
    isSelected,
    toggleOne,
    toggleAllVisible,
    selectVisibleRef,
    // category updating
    categoryUpdatingIds,
    bulkUpdating,
    // expanded rows
    expandedTransactionIds,
    // split state
    splitRowsByTransactionId,
    splitDraftsByTransactionId,
    splitSavingIds,
    // rule modal state
    ruleModalTransaction,
    ruleForm,
    setRuleForm,
    ruleModalError,
    ruleModalSubmitting,
    // category follow-up
    categoryFollowUpPrompt,
    // hide follow-up
    hideFollowUp,
    setHideFollowUp,
    // create category modal
    createCategoryForTxnId,
    setCreateCategoryForTxnId,
    createCategoryName,
    setCreateCategoryName,
    createCategorySubmitting,
    createCategoryError,
    setCreateCategoryError,
    // filter handlers
    handleStartDateChange,
    handleEndDateChange,
    handleAccountFilterChange,
    handleCategoryFilterChange,
    handleSearchChange,
    handleViewPresetChange,
    handlePreviousPage,
    handleNextPage,
    handleSortChange,
    clearAllFilters,
    removeFilterChip,
    // transaction actions
    toggleTransactionDetails,
    updateTransactionCategory,
    applyBulkCategoryUpdate,
    createCategory,
    hideTransaction,
    hideEverywhereAndCreateRule,
    // rule modal actions
    openRuleModal,
    closeRuleModal,
    createRuleFromTransaction,
    // category follow-up actions
    applyCategoryToSimilar,
    applyAndCreateRule,
    dismissCategoryFollowUpPrompt,
    toggleCategoryFollowUpAccountScope,
    // split actions
    addSplitLine,
    updateSplitLine,
    removeSplitLine,
    clearSplitDraft,
    saveSplitDraft,
  }
}
