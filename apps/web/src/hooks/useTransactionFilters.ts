import { useCallback, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PAGE_SIZE, UNCATEGORIZED_VALUE } from '@/hooks/useTransactions.helpers'
import type {
  SortColumn,
  SortDirection,
  TransactionViewPreset,
} from '@/lib/types'

type FilterChipKey = 'view' | 'date_range' | 'account' | 'category' | 'search'

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
  const [search, setSearch] = useState('')

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
    setSearch(event.target.value)
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
    else if (key === 'search') setSearch('')

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
