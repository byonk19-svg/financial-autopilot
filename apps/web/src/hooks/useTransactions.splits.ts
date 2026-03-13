import {
  createSplitDraftId,
  formatAmountInput,
  parseAmount,
} from '@/hooks/useTransactions.helpers'
import type {
  TransactionRow,
  TransactionSplitDraftLine,
  TransactionSplitRow,
} from '@/lib/types'

export function createSplitDraftFromRows(
  transaction: TransactionRow,
  rows: TransactionSplitRow[] | undefined,
): TransactionSplitDraftLine[] {
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
}

export function appendSplitDraftLine(
  existing: TransactionSplitDraftLine[],
): TransactionSplitDraftLine[] {
  return [
    ...existing,
    { draft_id: createSplitDraftId(), category_id: null, amount_input: '0.00', memo: '' },
  ]
}

export function updateSplitDraftLines(
  existing: TransactionSplitDraftLine[],
  draftId: string,
  updates: Partial<Pick<TransactionSplitDraftLine, 'category_id' | 'amount_input' | 'memo'>>,
): TransactionSplitDraftLine[] {
  return existing.map((line) => (line.draft_id === draftId ? { ...line, ...updates } : line))
}

export function removeSplitDraftLines(
  existing: TransactionSplitDraftLine[],
  draftId: string,
): TransactionSplitDraftLine[] {
  if (existing.length <= 1) {
    return existing
  }

  return existing.filter((line) => line.draft_id !== draftId)
}
