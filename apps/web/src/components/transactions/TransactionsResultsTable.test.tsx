import type { ReactNode } from 'react'
import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { TransactionsResultsTable } from './TransactionsResultsTable'
import type { TransactionRow } from '@/lib/types'

function collectElements(node: ReactNode, results: Array<{ type: unknown; props: Record<string, unknown> }> = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectElements(child, results))
    return results
  }

  if (!isValidElement(node)) return results

  results.push({
    type: node.type,
    props: (node.props as Record<string, unknown>) ?? {},
  })

  collectElements((node.props as { children?: ReactNode }).children, results)
  return results
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join('')
  if (!isValidElement(node)) return ''
  return textContent((node.props as { children?: ReactNode }).children)
}

describe('TransactionsResultsTable desktop density', () => {
  it('uses a sticky desktop header and reserves description for wider screens', () => {
    const transaction: TransactionRow = {
      id: 'txn-1',
      account_id: 'acct-1',
      category_id: null,
      user_category_id: null,
      posted_at: '2026-03-16T12:00:00.000Z',
      merchant_normalized: 'CLAUDE AI',
      merchant_canonical: 'CLAUDE AI',
      description_short: 'Anthropic subscription',
      amount: -20,
      currency: 'USD',
      is_pending: false,
    }

    const tree = TransactionsResultsTable({
      accountById: new Map(),
      accountNameById: new Map([['acct-1', 'Chase']]),
      allVisibleSelected: false,
      applyBulkCategoryUpdate: async () => {},
      bulkUpdating: false,
      categories: [],
      categoryNameById: new Map(),
      categoryUpdatingIds: new Set(),
      error: '',
      expandedTransactionIds: new Set(),
      fetching: false,
      handleNextPage: () => {},
      handlePreviousPage: () => {},
      handleSortChange: () => {},
      hasNextPage: false,
      hasPreviousPage: false,
      onOpenCreateCategory: () => {},
      openRuleModal: () => {},
      page: 1,
      saveSplitDraft: async () => {},
      selectedCount: 0,
      selectVisibleRef: { current: null },
      sortColumn: 'posted_at',
      sortDirection: 'desc',
      splitDraftsByTransactionId: {},
      splitRowsByTransactionId: {},
      splitSavingIds: new Set(),
      toggleAllVisible: () => {},
      toggleOne: () => {},
      toggleTransactionDetails: () => {},
      totalCount: 1,
      totalPages: 1,
      transactions: [transaction],
      updateSplitLine: () => {},
      updateTransactionCategory: async () => {},
      addSplitLine: () => {},
      clearSplitDraft: async () => {},
      hideTransaction: async () => {},
      isSelected: () => false,
      removeSplitLine: () => {},
    })

    const elements = collectElements(tree)
    const thead = elements.find((element) => element.type === 'thead')
    const descriptionHeader = elements.find(
      (element) => element.type === 'th' && textContent(element.props.children as ReactNode) === 'Description',
    )

    expect(String(thead?.props.className ?? '')).toContain('sticky')
    expect(String(thead?.props.className ?? '')).toContain('top-0')
    expect(String(descriptionHeader?.props.className ?? '')).toContain('xl:table-cell')
  })
})
