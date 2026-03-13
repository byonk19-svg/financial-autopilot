import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import {
  createSplitDraftId,
  isSplitTotalValid,
  parseAmount,
  parseAmountInput,
} from '@/hooks/useTransactions.helpers'
import { createSplitDraftFromRows } from '@/hooks/useTransactions.splits'
import type {
  TransactionRow,
  TransactionSplitDraftLine,
  TransactionSplitRow,
} from '@/lib/types'

export function validateSplitDraft(params: {
  draftLines: TransactionSplitDraftLine[]
  transaction: TransactionRow
}): string | null {
  const { draftLines, transaction } = params

  if (draftLines.length === 0) {
    return 'Add at least one split line before saving.'
  }

  const parsedLines = draftLines.map((line) => ({ ...line, amount: parseAmountInput(line.amount_input) }))
  const invalidAmountLine = parsedLines.find((line) => !Number.isFinite(line.amount))
  if (invalidAmountLine) {
    return 'One or more split amounts are invalid.'
  }

  const transactionAmount = parseAmount(transaction.amount)
  const splitTotal = parsedLines.reduce((sum, line) => sum + line.amount, 0)
  if (!isSplitTotalValid(splitTotal, transactionAmount)) {
    return 'Split total must equal the original transaction amount.'
  }

  return null
}

export async function clearTransactionSplitDraft(params: {
  transaction: TransactionRow
  userId: string
}): Promise<{
  nextDraft: TransactionSplitDraftLine[]
}> {
  const { transaction, userId } = params

  const { error } = await supabase
    .from('transaction_splits')
    .delete()
    .eq('user_id', userId)
    .eq('transaction_id', transaction.id)

  if (error) {
    captureException(error, {
      component: 'Transactions',
      action: 'clear-transaction-splits',
      transaction_id: transaction.id,
    })
    throw error
  }

  return {
    nextDraft: createSplitDraftFromRows(transaction, undefined),
  }
}

export async function saveTransactionSplitDraft(params: {
  draftLines: TransactionSplitDraftLine[]
  transaction: TransactionRow
  userId: string
}): Promise<{
  savedRows: TransactionSplitRow[]
}> {
  const { draftLines, transaction, userId } = params
  const parsedLines = draftLines.map((line) => ({ ...line, amount: parseAmountInput(line.amount_input) }))

  const { error: deleteError } = await supabase
    .from('transaction_splits')
    .delete()
    .eq('user_id', userId)
    .eq('transaction_id', transaction.id)

  if (deleteError) {
    captureException(deleteError, {
      component: 'Transactions',
      action: 'replace-transaction-splits-delete-step',
      transaction_id: transaction.id,
    })
    throw deleteError
  }

  const payload = parsedLines.map((line) => ({
    id: line.id ?? createSplitDraftId(),
    user_id: userId,
    transaction_id: transaction.id,
    category_id: line.category_id,
    amount: line.amount,
    memo: line.memo.trim() || null,
  }))

  const { data, error: upsertError } = await supabase
    .from('transaction_splits')
    .upsert(payload, { onConflict: 'id' })
    .select('id, transaction_id, category_id, amount, memo')

  if (upsertError) {
    captureException(upsertError, {
      component: 'Transactions',
      action: 'replace-transaction-splits-upsert-step',
      transaction_id: transaction.id,
    })
    throw upsertError
  }

  return {
    savedRows: (data ?? []) as TransactionSplitRow[],
  }
}
