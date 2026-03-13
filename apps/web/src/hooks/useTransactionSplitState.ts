import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  clearTransactionSplitDraft,
  saveTransactionSplitDraft,
  validateSplitDraft,
} from '@/hooks/useTransactions.splitPersistence'
import {
  appendSplitDraftLine,
  createSplitDraftFromRows,
  removeSplitDraftLines,
  updateSplitDraftLines,
} from '@/hooks/useTransactions.splits'
import type {
  TransactionRow,
  TransactionSplitDraftLine,
  TransactionSplitRow,
  TransactionToast,
} from '@/lib/types'

type SplitStateParams = {
  setToast: Dispatch<SetStateAction<TransactionToast | null>>
  userId: string | undefined
  visibleTransactionIds: string[]
}

export function useTransactionSplitState(params: SplitStateParams) {
  const { setToast, userId, visibleTransactionIds } = params
  const [expandedTransactionIds, setExpandedTransactionIds] = useState<Set<string>>(new Set())
  const [splitRowsByTransactionId, setSplitRowsByTransactionId] = useState<
    Record<string, TransactionSplitRow[]>
  >({})
  const [splitDraftsByTransactionId, setSplitDraftsByTransactionId] = useState<
    Record<string, TransactionSplitDraftLine[]>
  >({})
  const [splitSavingIds, setSplitSavingIds] = useState<Set<string>>(new Set())

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
    [splitRowsByTransactionId],
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
          [transaction.id]: appendSplitDraftLine(existing),
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
          [transactionId]: updateSplitDraftLines(existing, draftId, updates),
        }
      })
    },
    [],
  )

  const removeSplitLine = useCallback((transactionId: string, draftId: string) => {
    setSplitDraftsByTransactionId((current) => {
      const existing = current[transactionId]
      if (!existing) return current
      return {
        ...current,
        [transactionId]: removeSplitDraftLines(existing, draftId),
      }
    })
  }, [])

  const clearSplitDraft = useCallback(
    async (transaction: TransactionRow) => {
      if (!userId) return
      setSplitSavingIds((current) => new Set(current).add(transaction.id))

      try {
        const result = await clearTransactionSplitDraft({
          transaction,
          userId,
        })
        setSplitRowsByTransactionId((current) => ({ ...current, [transaction.id]: [] }))
        setSplitDraftsByTransactionId((current) => ({
          ...current,
          [transaction.id]: result.nextDraft,
        }))
        setToast({ id: Date.now(), tone: 'info', message: 'Splits cleared.' })
      } catch {
        setToast({ id: Date.now(), tone: 'error', message: 'Could not clear splits.' })
      }

      setSplitSavingIds((current) => {
        const next = new Set(current)
        next.delete(transaction.id)
        return next
      })
    },
    [setToast, userId],
  )

  const saveSplitDraft = useCallback(
    async (transaction: TransactionRow) => {
      if (!userId) return
      const draftLines = splitDraftsByTransactionId[transaction.id] ?? []
      const validationError = validateSplitDraft({ draftLines, transaction })
      if (validationError) {
        setToast({ id: Date.now(), tone: 'error', message: validationError })
        return
      }

      setSplitSavingIds((current) => new Set(current).add(transaction.id))

      try {
        const result = await saveTransactionSplitDraft({
          draftLines,
          transaction,
          userId,
        })
        setSplitRowsByTransactionId((current) => ({
          ...current,
          [transaction.id]: result.savedRows,
        }))
        setSplitDraftsByTransactionId((current) => ({
          ...current,
          [transaction.id]: createSplitDraftFromRows(transaction, result.savedRows),
        }))
        setToast({
          id: Date.now(),
          tone: 'info',
          message: `Saved ${result.savedRows.length} split line${result.savedRows.length === 1 ? '' : 's'}.`,
        })
      } catch {
        setToast({ id: Date.now(), tone: 'error', message: 'Could not save split lines.' })
      }

      setSplitSavingIds((current) => {
        const next = new Set(current)
        next.delete(transaction.id)
        return next
      })
    },
    [setToast, splitDraftsByTransactionId, userId],
  )

  return {
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
  }
}
