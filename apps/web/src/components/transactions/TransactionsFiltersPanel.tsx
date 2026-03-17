import type { ChangeEvent } from 'react'
import { TransactionFilterChips } from '@/components/transactions/TransactionFilterChips'
import {
  TRANSACTION_VIEW_PRESETS,
  UNCATEGORIZED_VALUE,
  describeTransactionsAdvancedFilters,
} from '@/hooks/useTransactions.helpers'
import type {
  AccountOption,
  CategoryOption,
  TransactionViewPreset,
} from '@/lib/types'
import type { TransactionFilterChip } from '@/hooks/useTransactionFilterChips'

type TransactionsFiltersPanelProps = {
  accounts: AccountOption[]
  activeFilterChips: TransactionFilterChip[]
  categories: CategoryOption[]
  accountFilter: string
  categoryFilter: string
  clearAllFilters: () => void
  endDate: string
  handleAccountFilterChange: (event: ChangeEvent<HTMLSelectElement>) => void
  handleCategoryFilterChange: (event: ChangeEvent<HTMLSelectElement>) => void
  handleEndDateChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleSearchChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleStartDateChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleViewPresetChange: (preset: TransactionViewPreset) => void
  hasActiveFilters: boolean
  removeFilterChip: (key: TransactionFilterChip['key']) => void
  search: string
  setShowHidden: (value: boolean) => void
  setShowPending: (value: boolean) => void
  showHidden: boolean
  showPending: boolean
  startDate: string
  totalCount: number
  viewPreset: TransactionViewPreset
}

export function TransactionsFiltersPanel({
  accounts,
  activeFilterChips,
  categories,
  accountFilter,
  categoryFilter,
  clearAllFilters,
  endDate,
  handleAccountFilterChange,
  handleCategoryFilterChange,
  handleEndDateChange,
  handleSearchChange,
  handleStartDateChange,
  handleViewPresetChange,
  hasActiveFilters,
  removeFilterChip,
  search,
  setShowHidden,
  setShowPending,
  showHidden,
  showPending,
  startDate,
  totalCount,
  viewPreset,
}: TransactionsFiltersPanelProps) {
  const advancedFilterSummary = describeTransactionsAdvancedFilters({
    startDate,
    endDate,
    accountFilter,
    categoryFilter,
    showPending,
    showHidden,
  })

  const renderAdvancedFilters = (idPrefix: string) => (
    <>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-transactions-start-date`} className="sr-only">Start date</label>
        <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Start date</span>
        <input
          id={`${idPrefix}-transactions-start-date`}
          type="date"
          value={startDate}
          onChange={handleStartDateChange}
          className="field-control"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-transactions-end-date`} className="sr-only">End date</label>
        <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">End date</span>
        <input
          id={`${idPrefix}-transactions-end-date`}
          type="date"
          value={endDate}
          onChange={handleEndDateChange}
          className="field-control"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-transactions-account-filter`} className="sr-only">Account filter</label>
        <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Account</span>
        <select
          id={`${idPrefix}-transactions-account-filter`}
          value={accountFilter}
          onChange={handleAccountFilterChange}
          className="field-control"
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-transactions-category-filter`} className="sr-only">Category filter</label>
        <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Category</span>
        <select
          id={`${idPrefix}-transactions-category-filter`}
          value={categoryFilter}
          onChange={handleCategoryFilterChange}
          className="field-control"
        >
          <option value="">All categories</option>
          <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:col-span-5 lg:flex lg:flex-wrap lg:items-end">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
          <input
            type="checkbox"
            checked={showPending}
            onChange={(event) => {
              setShowPending(event.target.checked)
            }}
            className="rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          Show pending
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(event) => {
              setShowHidden(event.target.checked)
            }}
            className="rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          Show hidden
        </label>
      </div>
    </>
  )

  return (
    <section aria-labelledby="transactions-heading" className="page-hero">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="transactions-heading" className="text-2xl font-semibold text-foreground">
            Transactions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Filter, categorize, and resolve uncategorized activity fast.
          </p>
        </div>
        <span className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {totalCount.toLocaleString()} total
        </span>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" role="group" aria-label="Transaction views">
        {TRANSACTION_VIEW_PRESETS.map((preset) => {
          const isActive = viewPreset === preset.value
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleViewPresetChange(preset.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'border-primary/25 bg-primary/15 text-primary'
                  : 'border-border/80 bg-muted/35 text-muted-foreground hover:bg-muted'
              }`}
              aria-pressed={isActive}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-1">
          <label htmlFor="transactions-search-filter" className="sr-only">Search merchant or description</label>
          <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Search transactions</span>
          <input
            id="transactions-search-filter"
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search transactions by merchant or description"
            className="field-control"
          />
        </div>

        <div className="lg:hidden">
          <details className="overflow-hidden rounded-2xl border border-border/80 bg-card/85">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">More filters</p>
                <p className="text-xs text-muted-foreground">{advancedFilterSummary}</p>
              </div>
              <span className="rounded-full border border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Expand
              </span>
            </summary>
            <div className="grid gap-3 border-t border-border/70 px-4 py-4 sm:grid-cols-2">
              {renderAdvancedFilters('mobile')}
            </div>
          </details>
        </div>
      </div>

      <div className="mt-4 hidden gap-3 md:grid-cols-2 lg:grid lg:grid-cols-5">
        {renderAdvancedFilters('desktop')}
      </div>

      {hasActiveFilters ? (
        <TransactionFilterChips
          chips={activeFilterChips}
          onRemoveChip={removeFilterChip}
          onClearAll={clearAllFilters}
        />
      ) : null}
    </section>
  )
}
