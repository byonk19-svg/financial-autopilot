import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  applyOptimisticBulkCategoryUpdate,
  applyOptimisticCategoryUpdate,
  buildCategoryFollowUpPrompt,
  createCategoryRecord,
  insertSortedCategory,
  normalizeCategoryValue,
  persistBulkTransactionCategoryUpdate,
  persistTransactionCategoryUpdate,
  revertOptimisticBulkCategoryUpdate,
  revertOptimisticCategoryUpdate,
} from '@/hooks/useTransactions.categories'
import {
  applyCategoryAndCreateRules,
  applyCategoryToSimilarTransactions,
  hideTransactionAndBuildFollowUp,
  hideTransactionsEverywhere,
} from '@/hooks/useTransactions.followUp'
import {
  buildRuleFormFromTransaction,
  createRuleFromTransactionAction,
  validateRuleForm,
} from '@/hooks/useTransactions.rules'
import type {
  CategoryFollowUpPromptState,
  CategoryOption,
  CreateRuleFormState,
  HideFollowUpState,
  TransactionRow,
  TransactionToast,
} from '@/lib/types'

type TransactionActionsParams = {
  categoryNameById: Map<string, string>
  clearSelection: () => void
  onRefreshRequested: () => void
  replaceSelection: (nextIds: string[]) => void
  selectedIdsArray: string[]
  setCategories: Dispatch<SetStateAction<CategoryOption[]>>
  setToast: Dispatch<SetStateAction<TransactionToast | null>>
  setTransactions: Dispatch<SetStateAction<TransactionRow[]>>
  transactions: TransactionRow[]
  userId: string | undefined
}

export function useTransactionActions(params: TransactionActionsParams) {
  const {
    categoryNameById,
    clearSelection,
    onRefreshRequested,
    replaceSelection,
    selectedIdsArray,
    setCategories,
    setToast,
    setTransactions,
    transactions,
    userId,
  } = params

  const [categoryUpdatingIds, setCategoryUpdatingIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [categoryFollowUpPrompt, setCategoryFollowUpPrompt] =
    useState<CategoryFollowUpPromptState | null>(null)
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
  const [createCategoryForTxnId, setCreateCategoryForTxnId] = useState<string | null>(null)
  const [createCategoryName, setCreateCategoryName] = useState('')
  const [createCategorySubmitting, setCreateCategorySubmitting] = useState(false)
  const [createCategoryError, setCreateCategoryError] = useState('')
  const [hideFollowUp, setHideFollowUp] = useState<HideFollowUpState | null>(null)

  const closeRuleModal = useCallback(() => {
    setRuleModalTransaction(null)
    setRuleModalError('')
    setRuleModalSubmitting(false)
  }, [])

  const openRuleModal = useCallback((transaction: TransactionRow) => {
    setRuleModalTransaction(transaction)
    setRuleForm(buildRuleFormFromTransaction(transaction))
    setRuleModalError('')
  }, [])

  const createRuleFromTransaction = useCallback(async () => {
    if (!userId || !ruleModalTransaction) return

    const validationError = validateRuleForm(ruleForm)
    if (validationError) {
      setRuleModalError(validationError)
      return
    }

    setRuleModalError('')
    setRuleModalSubmitting(true)

    try {
      const updatedCount = await createRuleFromTransactionAction({
        ruleForm,
        ruleModalTransaction,
        userId,
      })
      setToast({
        id: Date.now(),
        tone: 'info',
        message: `Rule created and applied. Updated ${updatedCount} transaction(s).`,
      })
      setRuleModalSubmitting(false)
      closeRuleModal()
      onRefreshRequested()
    } catch (error) {
      setRuleModalError(error instanceof Error ? error.message : 'Rule could not be created.')
      setRuleModalSubmitting(false)
    }
  }, [closeRuleModal, onRefreshRequested, ruleForm, ruleModalTransaction, setToast, userId])

  const dismissCategoryFollowUpPrompt = useCallback(() => {
    setCategoryFollowUpPrompt(null)
  }, [])

  const toggleCategoryFollowUpAccountScope = useCallback((checked: boolean) => {
    setCategoryFollowUpPrompt((current) =>
      current ? { ...current, includeAccountScope: checked } : current,
    )
  }, [])

  const applyCategoryToSimilar = useCallback(async () => {
    if (!userId || !categoryFollowUpPrompt || categoryFollowUpPrompt.pendingAction) return

    const prompt = categoryFollowUpPrompt
    setCategoryFollowUpPrompt((current) =>
      current ? { ...current, pendingAction: 'apply_similar' } : current,
    )

    try {
      const updatedCount = await applyCategoryToSimilarTransactions(prompt)
      setToast({
        id: Date.now(),
        tone: 'info',
        message: `Applied "${prompt.categoryName}" to ${updatedCount} similar transaction(s).`,
      })
      onRefreshRequested()
      setCategoryFollowUpPrompt(null)
    } catch {
      setToast({ id: Date.now(), tone: 'error', message: 'Could not apply category to similar transactions.' })
      setCategoryFollowUpPrompt((current) =>
        current ? { ...current, pendingAction: null } : current,
      )
    }
  }, [categoryFollowUpPrompt, onRefreshRequested, setToast, userId])

  const applyAndCreateRule = useCallback(async () => {
    if (!userId || !categoryFollowUpPrompt || categoryFollowUpPrompt.pendingAction) return

    const prompt = categoryFollowUpPrompt
    const sourceTransaction = transactions.find((transaction) => transaction.id === prompt.transactionId) ?? null
    setCategoryFollowUpPrompt((current) =>
      current ? { ...current, pendingAction: 'apply_and_rule' } : current,
    )

    try {
      const result = await applyCategoryAndCreateRules({
        prompt,
        sourceTransaction,
        userId,
      })
      setToast({
        id: Date.now(),
        tone: 'info',
        message: `Applied "${prompt.categoryName}" to ${result.updatedCount} past transaction(s) and saved future auto-categorization rules.${result.syncRuleWarning}${result.ownerRuleWarning} Analysis running in background -`,
        link: { href: '/subscriptions', label: 'check Recurring' },
      })
      onRefreshRequested()
      setCategoryFollowUpPrompt(null)
    } catch {
      setToast({ id: Date.now(), tone: 'error', message: 'Could not apply category to all transactions.' })
      setCategoryFollowUpPrompt((current) =>
        current ? { ...current, pendingAction: null } : current,
      )
    }
  }, [categoryFollowUpPrompt, onRefreshRequested, setToast, transactions, userId])

  const hideTransaction = useCallback(
    async (transaction: TransactionRow) => {
      if (!userId) return

      try {
        const nextHideFollowUp = await hideTransactionAndBuildFollowUp({
          transaction,
          userId,
        })
        setTransactions((current) => current.filter((row) => row.id !== transaction.id))
        setHideFollowUp(nextHideFollowUp)
      } catch {
        setToast({ id: Date.now(), tone: 'error', message: 'Could not hide transaction.' })
      }
    },
    [setToast, setTransactions, userId],
  )

  const hideEverywhereAndCreateRule = useCallback(async () => {
    if (!userId || !hideFollowUp || hideFollowUp.pending) return

    setHideFollowUp((current) => (current ? { ...current, pending: true } : current))

    try {
      const hiddenCount = await hideTransactionsEverywhere({
        hideFollowUp,
        userId,
      })
      setToast({
        id: Date.now(),
        tone: 'info',
        message: `Hidden ${hiddenCount} past transaction(s). Future matches will be hidden automatically.`,
      })
      setHideFollowUp(null)
      onRefreshRequested()
    } catch {
      setToast({ id: Date.now(), tone: 'error', message: 'Could not hide all matching transactions.' })
      setHideFollowUp((current) => (current ? { ...current, pending: false } : current))
    }
  }, [hideFollowUp, onRefreshRequested, setToast, userId])

  const updateTransactionCategory = useCallback(
    async (txnId: string, nextValue: string) => {
      if (!userId) return

      const categoryId = normalizeCategoryValue(nextValue)
      const optimisticUpdate = applyOptimisticCategoryUpdate(transactions, txnId, categoryId)

      setTransactions(optimisticUpdate.transactions)
      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        next.add(txnId)
        return next
      })

      try {
        await persistTransactionCategoryUpdate(txnId, categoryId)
        const prompt = buildCategoryFollowUpPrompt(
          optimisticUpdate.targetTransaction,
          categoryId,
          categoryNameById,
        )
        if (prompt) setCategoryFollowUpPrompt(prompt)
      } catch {
        setTransactions((current) =>
          revertOptimisticCategoryUpdate(current, txnId, optimisticUpdate.previousCategoryId),
        )
        setToast({ id: Date.now(), tone: 'error', message: 'Could not update category. Changes were reverted.' })
      }

      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(txnId)
        return next
      })
    },
    [categoryNameById, setToast, setTransactions, transactions, userId],
  )

  const createCategory = useCallback(async () => {
    if (!userId || !createCategoryForTxnId) return

    const name = createCategoryName.trim()
    if (!name) {
      setCreateCategoryError('Name is required.')
      return
    }

    setCreateCategorySubmitting(true)
    setCreateCategoryError('')

    try {
      const newCategory = await createCategoryRecord(userId, name)
      setCategories((current) => insertSortedCategory(current, newCategory))
      const txnId = createCategoryForTxnId
      setCreateCategoryForTxnId(null)
      setCreateCategoryName('')
      setCreateCategorySubmitting(false)
      void updateTransactionCategory(txnId, newCategory.id)
    } catch (error) {
      setCreateCategoryError(
        (error as { code?: string } | null)?.code === '23505'
          ? 'A category with that name already exists.'
          : 'Could not create category.',
      )
      setCreateCategorySubmitting(false)
    }
  }, [createCategoryForTxnId, createCategoryName, setCategories, updateTransactionCategory, userId])

  const applyBulkCategoryUpdate = useCallback(
    async (nextCategoryValue: string | null) => {
      if (!userId || selectedIdsArray.length === 0 || bulkUpdating) return

      const targetIds = [...selectedIdsArray]
      const nextCategoryId = normalizeCategoryValue(nextCategoryValue)
      const optimisticUpdate = applyOptimisticBulkCategoryUpdate(
        transactions,
        targetIds,
        nextCategoryId,
      )

      setBulkUpdating(true)
      setTransactions(optimisticUpdate.transactions)
      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        for (const id of targetIds) next.add(id)
        return next
      })

      try {
        const updatedIds = await persistBulkTransactionCategoryUpdate(targetIds, nextCategoryId)
        const updatedIdSet = new Set(updatedIds)
        const failedIds = targetIds.filter((id) => !updatedIdSet.has(id))

        if (failedIds.length > 0) {
          setTransactions((current) =>
            revertOptimisticBulkCategoryUpdate(
              current,
              optimisticUpdate.previousCategoryById,
              failedIds,
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
      } catch {
        setTransactions((current) =>
          revertOptimisticBulkCategoryUpdate(
            current,
            optimisticUpdate.previousCategoryById,
            targetIds,
          ),
        )
        setToast({
          id: Date.now(),
          tone: 'error',
          message: `Bulk update failed for ${targetIds.length} transaction(s). Changes were reverted.`,
        })
      }

      setCategoryUpdatingIds((current) => {
        const next = new Set(current)
        for (const id of targetIds) next.delete(id)
        return next
      })
      setBulkUpdating(false)
    },
    [
      bulkUpdating,
      clearSelection,
      replaceSelection,
      selectedIdsArray,
      setToast,
      setTransactions,
      transactions,
      userId,
    ],
  )

  return {
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
  }
}
