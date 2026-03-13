import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import { detectCanonicalMerchant, UNCATEGORIZED_VALUE } from '@/hooks/useTransactions.helpers'
import type {
  CategoryFollowUpPromptState,
  CategoryOption,
  TransactionRow,
} from '@/lib/types'

export function normalizeCategoryValue(nextValue: string | null): string | null {
  return nextValue === UNCATEGORIZED_VALUE ? null : nextValue
}

export function applyOptimisticCategoryUpdate(
  transactions: TransactionRow[],
  txnId: string,
  categoryId: string | null,
): {
  previousCategoryId: string | null
  targetTransaction: TransactionRow | null
  transactions: TransactionRow[]
} {
  let previousCategoryId: string | null = null
  let targetTransaction: TransactionRow | null = null

  const nextTransactions = transactions.map((row) => {
    if (row.id !== txnId) return row
    previousCategoryId = row.category_id
    targetTransaction = row
    return { ...row, category_id: categoryId }
  })

  return {
    previousCategoryId,
    targetTransaction,
    transactions: nextTransactions,
  }
}

export function revertOptimisticCategoryUpdate(
  transactions: TransactionRow[],
  txnId: string,
  previousCategoryId: string | null,
): TransactionRow[] {
  return transactions.map((row) => (row.id === txnId ? { ...row, category_id: previousCategoryId } : row))
}

export function buildCategoryFollowUpPrompt(
  transaction: TransactionRow | null,
  categoryId: string | null,
  categoryNameById: Map<string, string>,
): CategoryFollowUpPromptState | null {
  if (!transaction || !categoryId) return null

  const merchantCanonical = detectCanonicalMerchant(transaction)
  if (!merchantCanonical) return null

  return {
    transactionId: transaction.id,
    merchantCanonical,
    accountId: transaction.account_id,
    categoryId,
    categoryName: categoryNameById.get(categoryId) ?? 'Selected category',
    includeAccountScope: false,
    pendingAction: null,
  }
}

export async function persistTransactionCategoryUpdate(
  txnId: string,
  categoryId: string | null,
): Promise<void> {
  const { error } = await supabase.from('transactions').update({ category_id: categoryId }).eq('id', txnId)

  if (error) {
    captureException(error, {
      component: 'Transactions',
      action: 'update-transaction-category',
      transaction_id: txnId,
    })
    throw error
  }
}

export async function createCategoryRecord(
  userId: string,
  name: string,
): Promise<CategoryOption> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name })
    .select('id, name')
    .single()

  if (error) {
    captureException(error, { component: 'Transactions', action: 'create-category' })
    throw error
  }

  return data as CategoryOption
}

export function insertSortedCategory(
  categories: CategoryOption[],
  newCategory: CategoryOption,
): CategoryOption[] {
  return [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name))
}

export function applyOptimisticBulkCategoryUpdate(
  transactions: TransactionRow[],
  targetIds: string[],
  nextCategoryId: string | null,
): {
  previousCategoryById: Map<string, string | null>
  transactions: TransactionRow[]
} {
  const targetIdSet = new Set(targetIds)
  const previousCategoryById = new Map<string, string | null>()

  const nextTransactions = transactions.map((row) => {
    if (!targetIdSet.has(row.id)) return row
    previousCategoryById.set(row.id, row.category_id)
    return { ...row, category_id: nextCategoryId }
  })

  return {
    previousCategoryById,
    transactions: nextTransactions,
  }
}

export function revertOptimisticBulkCategoryUpdate(
  transactions: TransactionRow[],
  previousCategoryById: Map<string, string | null>,
  targetIds: Iterable<string>,
): TransactionRow[] {
  const targetIdSet = new Set(targetIds)
  return transactions.map((row) =>
    targetIdSet.has(row.id)
      ? { ...row, category_id: previousCategoryById.get(row.id) ?? null }
      : row,
  )
}

export async function persistBulkTransactionCategoryUpdate(
  targetIds: string[],
  nextCategoryId: string | null,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ category_id: nextCategoryId })
    .in('id', targetIds)
    .select('id')

  if (error) {
    captureException(error, {
      component: 'Transactions',
      action: 'bulk-update-transaction-category',
      transaction_count: String(targetIds.length),
    })
    throw error
  }

  return (data ?? []).map((row) => row.id)
}
