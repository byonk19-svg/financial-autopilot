import type { ReactNode } from 'react'
import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { TransactionsFiltersPanel } from './TransactionsFiltersPanel'

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

describe('TransactionsFiltersPanel', () => {
  it('makes the transaction search scope explicit', () => {
    const tree = TransactionsFiltersPanel({
      accounts: [],
      activeFilterChips: [],
      categories: [],
      accountFilter: '',
      categoryFilter: '',
      clearAllFilters: () => {},
      endDate: '',
      handleAccountFilterChange: () => {},
      handleCategoryFilterChange: () => {},
      handleEndDateChange: () => {},
      handleSearchChange: () => {},
      handleStartDateChange: () => {},
      handleViewPresetChange: () => {},
      hasActiveFilters: false,
      removeFilterChip: () => {},
      search: '',
      setShowHidden: () => {},
      setShowPending: () => {},
      showHidden: false,
      showPending: false,
      startDate: '',
      totalCount: 0,
      viewPreset: 'all',
    })

    const elements = collectElements(tree)
    const searchInput = elements.find(
      (element) => element.type === 'input' && element.props.id === 'transactions-search-filter',
    )
    const visibleSearchLabel = elements.find(
      (element) => element.type === 'span' && element.props['aria-hidden'] === 'true' && element.props.children === 'Search transactions',
    )

    expect(searchInput?.props.placeholder).toBe('Search transactions by merchant or description')
    expect(visibleSearchLabel).toBeDefined()
  })
})
