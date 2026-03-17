import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'
import { TRANSACTION_VIEW_PRESET_LABELS } from '@/hooks/useTransactions.helpers'
import {
  loadTransactionFilterOptions,
  loadTransactionsPage,
} from '@/hooks/useTransactions.data'
import { useTransactionActions } from '@/hooks/useTransactionActions'
import { useTransactionFilterChips } from '@/hooks/useTransactionFilterChips'
import { useTransactionFilters } from '@/hooks/useTransactionFilters'
import { useTransactionSelection } from '@/hooks/useTransactionSelection'
import { useTransactionSplitState } from '@/hooks/useTransactionSplitState'
import type {
  AccountOption,
  CategoryOption,
  TransactionRow,
  TransactionToast,
} from '@/lib/types'

export { UNCATEGORIZED_VALUE, TRANSACTION_VIEW_PRESETS } from '@/hooks/useTransactions.helpers'
export { isSplitTotalValid, parseAmount, parseAmountInput, resolveRuleId } from '@/hooks/useTransactions.helpers'

export function useTransactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useSession()

  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [toast, setToast] = useState<TransactionToast | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const selectVisibleRef = useRef<HTMLInputElement>(null)

  const {
    page,
    setPage,
    totalCount,
    setTotalCount,
    totalPages,
    hasPreviousPage,
    hasNextPage,
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
    searchInput,
    search,
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
  } = useTransactionFilters(location.search)

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const accountById = useMemo(() => {
    const map = new Map<string, AccountOption>()
    for (const account of accounts) map.set(account.id, account)
    return map
  }, [accounts])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) map.set(category.id, category.name)
    return map
  }, [categories])

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

  const requestRefresh = useCallback(() => {
    setRefreshNonce((current) => current + 1)
  }, [])

  const {
    expandedTransactionIds,
    splitRowsByTransactionId,
    setSplitRowsByTransactionId,
    splitDraftsByTransactionId,
    setSplitDraftsByTransactionId,
    splitSavingIds,
    toggleTransactionDetails,
    addSplitLine,
    updateSplitLine,
    removeSplitLine,
    clearSplitDraft,
    saveSplitDraft,
  } = useTransactionSplitState({
    setToast,
    userId: session?.user?.id,
    visibleTransactionIds,
  })

  const {
    categoryUpdatingIds,
    bulkUpdating,
    categoryFollowUpPrompt,
    ruleModalTransaction,
    ruleForm,
    setRuleForm,
    ruleModalError,
    ruleModalSubmitting,
    hideFollowUp,
    setHideFollowUp,
    createCategoryForTxnId,
    setCreateCategoryForTxnId,
    createCategoryName,
    setCreateCategoryName,
    createCategorySubmitting,
    createCategoryError,
    setCreateCategoryError,
    openRuleModal,
    closeRuleModal,
    createRuleFromTransaction,
    dismissCategoryFollowUpPrompt,
    toggleCategoryFollowUpAccountScope,
    applyCategoryToSimilar,
    applyAndCreateRule,
    hideTransaction,
    hideEverywhereAndCreateRule,
    updateTransactionCategory,
    createCategory,
    applyBulkCategoryUpdate,
  } = useTransactionActions({
    categoryNameById,
    clearSelection,
    onRefreshRequested: requestRefresh,
    replaceSelection,
    selectedIdsArray,
    setCategories,
    setToast,
    setTransactions,
    transactions,
    userId: session?.user?.id,
  })

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
    const loadFilterOptions = async () => {
      if (loading) return
      if (!session?.user) {
        navigate(getLoginRedirectPath(), { replace: true })
        return
      }

      try {
        setError('')
        const nextFilterOptions = await loadTransactionFilterOptions(session.user.id)
        setAccounts(nextFilterOptions.accounts)
        setCategories(nextFilterOptions.categories)
      } catch {
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

        const result = await loadTransactionsPage({
          accountFilter,
          categoryFilter,
          endDate,
          page,
          search,
          showHidden,
          showPending,
          sortColumn,
          sortDirection,
          startDate,
          userId: session.user.id,
          viewPreset,
        })

        if (!active) return

        if (result.kind === 'page_clamped') {
          setPage(result.totalPages)
          return
        }

        setTransactions(result.transactions)
        setSplitRowsByTransactionId(result.splitRowsByTransactionId)
        setSplitDraftsByTransactionId((current) => ({
          ...current,
          ...result.splitDraftsByTransactionId,
        }))
        setTotalCount(result.totalCount)
        setFetching(false)
      } catch {
        if (!active) return
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
    endDate,
    loading,
    page,
    refreshNonce,
    search,
    session,
    setPage,
    setSplitDraftsByTransactionId,
    setSplitRowsByTransactionId,
    setTotalCount,
    showHidden,
    showPending,
    sortColumn,
    sortDirection,
    startDate,
    viewPreset,
  ])

  return {
    accounts,
    categories,
    transactions,
    fetching,
    error,
    toast,
    setToast,
    page,
    totalCount,
    totalPages,
    hasPreviousPage,
    hasNextPage,
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
    searchInput,
    search,
    accountById,
    accountNameById,
    categoryNameById,
    activeFilterChips,
    hasActiveFilters,
    allVisibleSelected,
    selectedCount,
    isSelected,
    toggleOne,
    toggleAllVisible,
    selectVisibleRef,
    categoryUpdatingIds,
    bulkUpdating,
    expandedTransactionIds,
    splitRowsByTransactionId,
    splitDraftsByTransactionId,
    splitSavingIds,
    ruleModalTransaction,
    ruleForm,
    setRuleForm,
    ruleModalError,
    ruleModalSubmitting,
    categoryFollowUpPrompt,
    hideFollowUp,
    setHideFollowUp,
    createCategoryForTxnId,
    setCreateCategoryForTxnId,
    createCategoryName,
    setCreateCategoryName,
    createCategorySubmitting,
    createCategoryError,
    setCreateCategoryError,
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
    toggleTransactionDetails,
    updateTransactionCategory,
    applyBulkCategoryUpdate,
    createCategory,
    hideTransaction,
    hideEverywhereAndCreateRule,
    openRuleModal,
    closeRuleModal,
    createRuleFromTransaction,
    applyCategoryToSimilar,
    applyAndCreateRule,
    dismissCategoryFollowUpPrompt,
    toggleCategoryFollowUpAccountScope,
    addSplitLine,
    updateSplitLine,
    removeSplitLine,
    clearSplitDraft,
    saveSplitDraft,
  }
}
