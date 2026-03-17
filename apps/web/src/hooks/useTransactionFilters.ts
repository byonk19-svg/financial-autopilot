import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PAGE_SIZE, UNCATEGORIZED_VALUE } from '@/hooks/useTransactions.helpers'
import type {
  SortColumn,
  SortDirection,
  TransactionViewPreset,
} from '@/lib/types'

type FilterChipKey = 'view' | 'date_range' | 'account' | 'category' | 'search'

export const TRANSACTION_SEARCH_DEBOUNCE_MS = 250

export function createDebouncedValueCommitter<T>(
  onCommit: (value: T) => void,
  delayMs: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return {
    schedule(value: T) {
      if (timeout !== null) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => {
        timeout = null
        onCommit(value)
      }, delayMs)
    },
    cancel() {
      if (timeout === null) return
      clearTimeout(timeout)
      timeout = null
    },
  }
}

export function useTransactionFilters(initialSearch: string) {
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortColumn, setSortColumn] = useState<SortColumn>('posted_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [viewPreset, setViewPreset] = useState<TransactionViewPreset>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(() => {
    const params = new URLSearchParams(initialSearch)
    const category = params.get('category')
    return category === UNCATEGORIZED_VALUE ? UNCATEGORIZED_VALUE : ''
  })
  const [showPending, setShowPending] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const committer = createDebouncedValueCommitter(setSearch, TRANSACTION_SEARCH_DEBOUNCE_MS)
    committer.schedule(searchInput)
    return () => {
      committer.cancel()
    }
  }, [searchInput])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount])
  const hasPreviousPage = page > 1
  const hasNextPage = page < totalPages

  const handleStartDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setStartDate(event.target.value)
    setPage(1)
  }, [])

  const handleEndDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEndDate(event.target.value)
    setPage(1)
  }, [])

  const handleAccountFilterChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setAccountFilter(event.target.value)
    setPage(1)
  }, [])

  const handleCategoryFilterChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(event.target.value)
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value)
    setPage(1)
  }, [])

  const handleViewPresetChange = useCallback((preset: TransactionViewPreset) => {
    setViewPreset(preset)
    setPage(1)
  }, [])

  const handlePreviousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPage((current) => current + 1)
  }, [])

  const handleSortChange = useCallback((column: SortColumn) => {
    setPage(1)
    setSortColumn((currentColumn) => {
      if (currentColumn === column) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
        return currentColumn
      }

      setSortDirection(column === 'merchant_normalized' ? 'asc' : 'desc')
      return column
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setViewPreset('all')
    setStartDate('')
    setEndDate('')
    setAccountFilter('')
    setCategoryFilter('')
    setShowPending(false)
    setShowHidden(false)
    setSearchInput('')
    setSearch('')
    setPage(1)
  }, [])

  const removeFilterChip = useCallback((key: FilterChipKey) => {
    if (key === 'view') setViewPreset('all')
    else if (key === 'date_range') {
      setStartDate('')
      setEndDate('')
    } else if (key === 'account') setAccountFilter('')
    else if (key === 'category') setCategoryFilter('')
    else if (key === 'search') {
      setSearchInput('')
      setSearch('')
    }

    setPage(1)
  }, [])

  return {
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
  }
}
