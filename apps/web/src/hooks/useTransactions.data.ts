import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import {
  buildSearchAndCategoryOrFilter,
  FALLBACK_CATEGORY_NAMES,
  PAGE_SIZE,
  toEndOfDayIso,
  toStartOfDayIso,
} from '@/hooks/useTransactions.helpers'
import { createSplitDraftFromRows } from '@/hooks/useTransactions.splits'
import type {
  AccountOption,
  CategoryOption,
  SortColumn,
  SortDirection,
  TransactionRow,
  TransactionSplitDraftLine,
  TransactionSplitRow,
  TransactionViewPreset,
} from '@/lib/types'

type LoadTransactionsPageParams = {
  accountFilter: string
  categoryFilter: string
  endDate: string
  page: number
  search: string
  showHidden: boolean
  showPending: boolean
  sortColumn: SortColumn
  sortDirection: SortDirection
  startDate: string
  userId: string
  viewPreset: TransactionViewPreset
}

type LoadedTransactionsPage = {
  kind: 'loaded'
  splitDraftsByTransactionId: Record<string, TransactionSplitDraftLine[]>
  splitRowsByTransactionId: Record<string, TransactionSplitRow[]>
  totalCount: number
  transactions: TransactionRow[]
}

type ClampedTransactionsPage = {
  kind: 'page_clamped'
  totalPages: number
}

export type LoadTransactionsPageResult = LoadedTransactionsPage | ClampedTransactionsPage

export async function loadTransactionFilterOptions(userId: string): Promise<{
  accounts: AccountOption[]
  categories: CategoryOption[]
}> {
  const [accountsResult, categoriesResult] = await Promise.all([
    supabase.from('accounts').select('id, name').eq('user_id', userId).order('name', { ascending: true }),
    supabase.from('categories').select('id, name').eq('user_id', userId).order('name', { ascending: true }),
  ])

  if (accountsResult.error || categoriesResult.error) {
    const error = accountsResult.error ?? categoriesResult.error
    captureException(error, {
      component: 'Transactions',
      action: 'load-filter-options',
    })
    throw error
  }

  let nextCategories = (categoriesResult.data ?? []) as CategoryOption[]
  const hasSeededCategories = nextCategories.some(
    (category) => category.name.trim().toLowerCase() !== 'uncategorized',
  )

  if (!hasSeededCategories) {
    nextCategories = await seedCategoriesIfNeeded(userId, nextCategories)
  }

  return {
    accounts: (accountsResult.data ?? []) as AccountOption[],
    categories: nextCategories,
  }
}

async function seedCategoriesIfNeeded(
  userId: string,
  categories: CategoryOption[],
): Promise<CategoryOption[]> {
  let nextCategories = categories
  const seedResult = await supabase.rpc('seed_user_categories')

  if (seedResult.error) {
    captureException(seedResult.error, {
      component: 'Transactions',
      action: 'seed-user-categories',
    })

    const fallbackSeedResult = await supabase.from('categories').upsert(
      FALLBACK_CATEGORY_NAMES.map((name) => ({ user_id: userId, name })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )

    if (fallbackSeedResult.error) {
      captureException(fallbackSeedResult.error, {
        component: 'Transactions',
        action: 'seed-user-categories-fallback',
      })
    }
  } else {
    const refreshedCategories = await reloadCategories(userId, 'reload-seeded-categories')
    if (refreshedCategories) {
      nextCategories = refreshedCategories
    }
  }

  const fallbackRefreshed = await reloadCategories(userId, 'reload-fallback-categories')
  return fallbackRefreshed ?? nextCategories
}

async function reloadCategories(
  userId: string,
  action: 'reload-fallback-categories' | 'reload-seeded-categories',
): Promise<CategoryOption[] | null> {
  const refreshedResult = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (refreshedResult.error) {
    captureException(refreshedResult.error, {
      component: 'Transactions',
      action,
    })
    return null
  }

  return (refreshedResult.data ?? []) as CategoryOption[]
}

export async function loadTransactionsPage(
  params: LoadTransactionsPageParams,
): Promise<LoadTransactionsPageResult> {
  const {
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
    userId,
    viewPreset,
  } = params

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const searchQuery = search.trim().replace(/[(),]/g, ' ')

  let query = supabase
    .from('transactions')
    .select(
      'id, account_id, category_id, user_category_id, type, category, owner, category_source, rule_id, classification_rule_ref, posted_at, merchant_canonical, merchant_normalized, description_short, description_full, amount, currency, is_hidden, is_pending',
      { count: 'exact' },
    )
    .eq('user_id', userId)
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

  if (transactionsError) {
    captureException(transactionsError, {
      component: 'Transactions',
      action: 'load-transactions',
    })
    throw transactionsError
  }

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  if (page > totalPages) {
    return { kind: 'page_clamped', totalPages }
  }

  const transactions = (data ?? []) as TransactionRow[]
  const splitRowsByTransactionId = await loadTransactionSplitRows(userId, transactions)
  const splitDraftsByTransactionId: Record<string, TransactionSplitDraftLine[]> = {}

  for (const transaction of transactions) {
    splitDraftsByTransactionId[transaction.id] = createSplitDraftFromRows(
      transaction,
      splitRowsByTransactionId[transaction.id],
    )
  }

  return {
    kind: 'loaded',
    splitDraftsByTransactionId,
    splitRowsByTransactionId,
    totalCount,
    transactions,
  }
}

async function loadTransactionSplitRows(
  userId: string,
  transactions: TransactionRow[],
): Promise<Record<string, TransactionSplitRow[]>> {
  const splitRowsByTransactionId: Record<string, TransactionSplitRow[]> = {}

  for (const transaction of transactions) {
    splitRowsByTransactionId[transaction.id] = []
  }

  if (transactions.length === 0) {
    return splitRowsByTransactionId
  }

  const transactionIds = transactions.map((transaction) => transaction.id)
  const { data: splitRows, error: splitRowsError } = await supabase
    .from('transaction_splits')
    .select('id, transaction_id, category_id, amount, memo')
    .eq('user_id', userId)
    .in('transaction_id', transactionIds)

  if (splitRowsError) {
    captureException(splitRowsError, {
      component: 'Transactions',
      action: 'load-transaction-splits',
    })
    return splitRowsByTransactionId
  }

  for (const splitRow of (splitRows ?? []) as TransactionSplitRow[]) {
    if (!splitRowsByTransactionId[splitRow.transaction_id]) {
      splitRowsByTransactionId[splitRow.transaction_id] = []
    }
    splitRowsByTransactionId[splitRow.transaction_id].push(splitRow)
  }

  return splitRowsByTransactionId
}
