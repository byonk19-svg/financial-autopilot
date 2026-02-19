import { useMemo } from 'react'

export type TransactionFilterChip = {
  key: 'view' | 'date_range' | 'account' | 'category' | 'search'
  label: string
}

type UseTransactionFilterChipsParams = {
  viewPresetLabel: string | null
  startDate: string
  endDate: string
  accountFilter: string
  categoryFilter: string
  search: string
  accountNameById: Map<string, string>
  categoryNameById: Map<string, string>
}

function formatDateRangeLabel(startDate: string, endDate: string): string | null {
  if (!startDate && !endDate) return null
  if (startDate && endDate) return `Date: ${startDate} to ${endDate}`
  if (startDate) return `Date: from ${startDate}`
  return `Date: through ${endDate}`
}

export function useTransactionFilterChips({
  viewPresetLabel,
  startDate,
  endDate,
  accountFilter,
  categoryFilter,
  search,
  accountNameById,
  categoryNameById,
}: UseTransactionFilterChipsParams) {
  const chips = useMemo(() => {
    const nextChips: TransactionFilterChip[] = []

    if (viewPresetLabel) {
      nextChips.push({
        key: 'view',
        label: viewPresetLabel,
      })
    }

    const dateLabel = formatDateRangeLabel(startDate, endDate)
    if (dateLabel) {
      nextChips.push({
        key: 'date_range',
        label: dateLabel,
      })
    }

    if (accountFilter) {
      nextChips.push({
        key: 'account',
        label: `Account: ${accountNameById.get(accountFilter) ?? accountFilter}`,
      })
    }

    if (categoryFilter) {
      nextChips.push({
        key: 'category',
        label: `Category: ${categoryNameById.get(categoryFilter) ?? categoryFilter}`,
      })
    }

    const trimmedSearch = search.trim()
    if (trimmedSearch) {
      nextChips.push({
        key: 'search',
        label: `Search: "${trimmedSearch}"`,
      })
    }

    return nextChips
  }, [accountFilter, accountNameById, categoryFilter, categoryNameById, endDate, search, startDate, viewPresetLabel])

  return {
    chips,
    hasActiveFilters: chips.length > 0,
  }
}
