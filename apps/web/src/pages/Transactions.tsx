import { useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TransactionFilterChips } from '@/components/transactions/TransactionFilterChips'
import { CreateRuleModal } from '@/components/transactions/CreateRuleModal'
import { CategoryFollowUpBanner } from '@/components/transactions/CategoryFollowUpBanner'
import { HideFollowUpBanner } from '@/components/transactions/HideFollowUpBanner'
import { useModalA11y } from '@/hooks/useModalA11y'
import {
  TRANSACTION_VIEW_PRESETS,
  UNCATEGORIZED_VALUE,
  parseAmount,
  parseAmountInput,
  isSplitTotalValid,
  resolveRuleId,
  useTransactions,
} from '@/hooks/useTransactions'
import type { TransactionViewPreset } from '@/lib/types'

export default function Transactions() {
  const {
    accounts,
    categories,
    transactions,
    fetching,
    error,
    toast,
    setToast,
    page,
    totalCount,
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
    accountNameById,
    categoryNameById,
    activeFilterChips,
    hasActiveFilters,
    allVisibleSelected,
    selectedCount,
    isSelected,
    toggleOne,
    toggleAllVisible,
    selectVisibleRef,
    categoryUpdatingIds,
    bulkUpdating,
    expandedTransactionIds,
    splitRowsByTransactionId,
    splitDraftsByTransactionId,
    splitSavingIds,
    ruleModalTransaction,
    ruleForm,
    setRuleForm,
    ruleModalError,
    ruleModalSubmitting,
    categoryFollowUpPrompt,
    hideFollowUp,
    setHideFollowUp,
    createCategoryForTxnId,
    setCreateCategoryForTxnId,
    createCategoryName,
    setCreateCategoryName,
    createCategorySubmitting,
    createCategoryError,
    setCreateCategoryError,
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
    toggleTransactionDetails,
    updateTransactionCategory,
    applyBulkCategoryUpdate,
    createCategory,
    hideTransaction,
    hideEverywhereAndCreateRule,
    openRuleModal,
    closeRuleModal,
    createRuleFromTransaction,
    applyCategoryToSimilar,
    applyAndCreateRule,
    dismissCategoryFollowUpPrompt,
    toggleCategoryFollowUpAccountScope,
    addSplitLine,
    updateSplitLine,
    removeSplitLine,
    clearSplitDraft,
    saveSplitDraft,
  } = useTransactions()
  const createCategoryModalRef = useRef<HTMLDivElement>(null)
  const createCategoryInputRef = useRef<HTMLInputElement>(null)

  const closeCreateCategoryModal = useCallback(() => {
    setCreateCategoryForTxnId(null)
    setCreateCategoryName('')
    setCreateCategoryError('')
  }, [setCreateCategoryError, setCreateCategoryForTxnId, setCreateCategoryName])

  useModalA11y({
    open: Boolean(createCategoryForTxnId),
    onClose: closeCreateCategoryModal,
    containerRef: createCategoryModalRef,
    initialFocusRef: createCategoryInputRef,
  })

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 lg:space-y-6" aria-busy={fetching} data-testid="transactions-page">
      {/* ── header + filters ─────────────────────────────────────────────── */}
      <section aria-labelledby="transactions-heading" className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 id="transactions-heading" className="text-2xl font-semibold text-foreground">
          Transactions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Filter and review synced transactions.</p>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Transaction views">
          {TRANSACTION_VIEW_PRESETS.map((preset) => {
            const isActive = viewPreset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleViewPresetChange(preset.value as TransactionViewPreset)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted/50 text-muted-foreground border border-border hover:bg-muted'
                }`}
                aria-pressed={isActive}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="transactions-start-date" className="sr-only">Start date</label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Start date</span>
            <input
              id="transactions-start-date"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-end-date" className="sr-only">End date</label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">End date</span>
            <input
              id="transactions-end-date"
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-account-filter" className="sr-only">Account filter</label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Account</span>
            <select
              id="transactions-account-filter"
              value={accountFilter}
              onChange={handleAccountFilterChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-category-filter" className="sr-only">Category filter</label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Category</span>
            <select
              id="transactions-category-filter"
              value={categoryFilter}
              onChange={handleCategoryFilterChange}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All categories</option>
              <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="transactions-search-filter" className="sr-only">Search merchant or description</label>
            <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">Search</span>
            <input
              id="transactions-search-filter"
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Merchant or description"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              <input
                type="checkbox"
                checked={showPending}
                onChange={(e) => { setShowPending(e.target.checked) }}
                className="rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Show pending
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => { setShowHidden(e.target.checked) }}
                className="rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Show hidden
            </label>
          </div>
        </div>

        {hasActiveFilters ? (
          <TransactionFilterChips chips={activeFilterChips} onRemoveChip={removeFilterChip} onClearAll={clearAllFilters} />
        ) : null}
      </section>

      {/* ── results table ────────────────────────────────────────────────── */}
      <section
        aria-labelledby="transactions-results-heading"
        className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
      >
        <h2 id="transactions-results-heading" className="sr-only">Transaction results</h2>

        {fetching ? (
          <div className="p-4" aria-live="polite" aria-busy="true">
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-7 gap-4 border-b border bg-muted px-4 py-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
                ))}
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-7 gap-4 px-4 py-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="h-3 w-20 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-rose-600" role="alert" aria-live="polite">{error}</p>
        ) : (
          <div className="p-4" aria-live="polite">
            <p className="mb-3 text-sm text-muted-foreground" role="status">
              Showing {transactions.length} of {totalCount} transactions
            </p>

            {selectedCount > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{selectedCount} selected on this page</p>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={bulkUpdating}
                        className="inline-flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>Set category</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {categories.map((category) => (
                        <DropdownMenuItem
                          key={category.id}
                          onClick={() => void applyBulkCategoryUpdate(category.id)}
                          disabled={bulkUpdating}
                          className="truncate"
                        >
                          {category.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    onClick={() => void applyBulkCategoryUpdate(UNCATEGORIZED_VALUE)}
                    disabled={bulkUpdating}
                    className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear category
                  </button>
                </div>
              </div>
            )}

            {transactions.length === 0 ? (
              <div
                className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border bg-muted/30 px-4 text-center"
                role="status"
                aria-live="polite"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-muted-foreground/60" aria-hidden="true">
                  <path
                    d="M8 8h8M8 12h8M8 16h5M6 3h9l3 3v15H6z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-3 text-base font-medium text-foreground">No transactions match your filters</p>
                <p className="mt-1 text-sm text-muted-foreground">Try widening date range, account, category, or search.</p>
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input
                          ref={selectVisibleRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(event) => toggleAllVisible(event.target.checked)}
                          disabled={transactions.length === 0 || fetching || bulkUpdating}
                          aria-label="Select visible transactions"
                          className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </th>
                      {([
                        { key: 'posted_at', label: 'Date' },
                        { key: 'merchant_normalized', label: 'Merchant' },
                      ] as const).map(({ key, label }) => (
                        <th key={key} className="px-4 py-3 font-semibold">
                          <button
                            type="button"
                            onClick={() => handleSortChange(key)}
                            className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                          >
                            {label}
                            {sortColumn === key ? (sortDirection === 'asc' ? '^' : 'v') : ''}
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSortChange('amount')}
                          className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                        >
                          Amount
                          {sortColumn === 'amount' ? (sortDirection === 'asc' ? '^' : 'v') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((transaction) => {
                      const amount = parseAmount(transaction.amount)
                      const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id
                      const categoryName = effectiveCategoryId ? categoryNameById.get(effectiveCategoryId) : null
                      const localCategoryValue = transaction.category_id ?? UNCATEGORIZED_VALUE
                      const isCategoryUpdating = categoryUpdatingIds.has(transaction.id)
                      const isExpanded = expandedTransactionIds.has(transaction.id)
                      const matchedRuleId = resolveRuleId(transaction)
                      const accountName = accountNameById.get(transaction.account_id) ?? 'Unknown account'
                      const rawMerchant = transaction.merchant_normalized ?? 'Not available'
                      const rawDescription = transaction.description_full ?? transaction.description_short ?? 'Not available'
                      const categorySource = transaction.category_source ?? null
                      const splitRows = splitRowsByTransactionId[transaction.id] ?? []
                      const splitCount = splitRows.length
                      const hasSplits = splitCount > 0
                      const splitDraft = splitDraftsByTransactionId[transaction.id] ?? []
                      const splitTotal = splitDraft.reduce((sum, line) => sum + parseAmountInput(line.amount_input), 0)
                      const splitBalanceDelta = amount - splitTotal
                      const splitValid = isSplitTotalValid(splitTotal, amount)
                      const isSplitSaving = splitSavingIds.has(transaction.id)

                      return [
                        <tr key={`${transaction.id}-row`} className="hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected(transaction.id)}
                              onChange={(event) => toggleOne(transaction.id, event.target.checked)}
                              disabled={isCategoryUpdating || bulkUpdating}
                              aria-label={`Select transaction ${transaction.id}`}
                              className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(transaction.posted_at), 'yyyy-MM-dd')}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {transaction.merchant_normalized || accountNameById.get(transaction.account_id) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{transaction.description_short}</td>
                          <td className={`px-4 py-3 ${amount < 0 ? 'font-medium text-emerald-600' : 'text-foreground'}`}>
                            {amount.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {hasSplits ? (
                              <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                Split ({splitCount})
                              </span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isCategoryUpdating || bulkUpdating}
                                    className="inline-flex min-w-[11rem] items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={`Edit category for ${transaction.description_short}`}
                                  >
                                    <span className="truncate">{categoryName ?? 'Uncategorized'}</span>
                                    {isCategoryUpdating ? (
                                      <span className="text-xs text-muted-foreground">Saving...</span>
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                  <DropdownMenuRadioGroup
                                    value={localCategoryValue}
                                    onValueChange={(value: string) => {
                                      if (value === localCategoryValue || isCategoryUpdating || bulkUpdating) return
                                      void updateTransactionCategory(transaction.id, value)
                                    }}
                                  >
                                    <DropdownMenuRadioItem value={UNCATEGORIZED_VALUE}>
                                      <div className="flex w-full items-center justify-between">
                                        <span>Uncategorized</span>
                                        {localCategoryValue === UNCATEGORIZED_VALUE && <Check className="h-3.5 w-3.5" />}
                                      </div>
                                    </DropdownMenuRadioItem>
                                    {categories.map((category) => (
                                      <DropdownMenuRadioItem key={category.id} value={category.id}>
                                        <div className="flex w-full items-center justify-between gap-3">
                                          <span className="truncate">{category.name}</span>
                                          {localCategoryValue === category.id && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setCreateCategoryForTxnId(transaction.id)
                                      setCreateCategoryName('')
                                      setCreateCategoryError('')
                                    }}
                                    className="text-primary"
                                  >
                                    + New category...
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleTransactionDetails(transaction)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-expanded={isExpanded}
                              aria-controls={`transaction-details-${transaction.id}`}
                            >
                              {isExpanded ? 'Hide' : 'Show'}
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                        </tr>,

                        isExpanded ? (
                          <tr key={`${transaction.id}-details`} id={`transaction-details-${transaction.id}`} className="bg-muted/20">
                            <td colSpan={7} className="px-4 pb-4 pt-0">
                              <div className="mt-1 rounded-lg border border-border bg-muted/30 p-4">
                                <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Raw merchant</p>
                                    <p className="mt-1 break-words text-foreground">{rawMerchant}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Raw description</p>
                                    <p className="mt-1 break-words text-foreground">{rawDescription}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
                                    <p className="mt-1 break-words text-foreground">{accountName}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                                    <p className={`mt-1 ${amount < 0 ? 'font-medium text-emerald-600' : 'text-foreground'}`}>
                                      {amount.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</p>
                                    <p className="mt-1 text-foreground">{format(new Date(transaction.posted_at), 'yyyy-MM-dd HH:mm')}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category source</p>
                                    <p className="mt-1 text-foreground">{categorySource ?? 'Not available'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
                                    <p className="mt-1 text-foreground">{categoryName ?? 'Uncategorized'}</p>
                                  </div>
                                  <div className="md:col-span-2 xl:col-span-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Matched rule</p>
                                    {matchedRuleId ? (
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="text-foreground">Rule {matchedRuleId}</span>
                                        <Link to={`/rules?ruleId=${matchedRuleId}`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                                          Open in Rules
                                        </Link>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-foreground">No matched rule</p>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border pt-3">
                                  <div className="space-y-1">
                                    <label htmlFor={`transaction-detail-category-${transaction.id}`} className="text-xs font-medium text-muted-foreground">
                                      Edit category
                                    </label>
                                    <select
                                      id={`transaction-detail-category-${transaction.id}`}
                                      value={localCategoryValue}
                                      disabled={isCategoryUpdating || bulkUpdating}
                                      onChange={(event) => {
                                        const value = event.target.value
                                        if (value === localCategoryValue || isCategoryUpdating || bulkUpdating) return
                                        void updateTransactionCategory(transaction.id, value)
                                      }}
                                      className="min-w-[12rem] rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
                                      {categories.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => openRuleModal(transaction)}
                                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    Create rule from this transaction
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void hideTransaction(transaction)}
                                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    Hide this transaction
                                  </button>
                                </div>

                                {/* ── split transaction ───────────────────── */}
                                <div className="mt-4 space-y-3 border-t border pt-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Split transaction</p>
                                      <p className="text-xs text-muted-foreground">Split total must equal original amount.</p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${splitValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        Total {splitTotal.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Delta {splitBalanceDelta.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    {splitDraft.map((line) => (
                                      <div
                                        key={line.draft_id}
                                        className="grid gap-2 rounded-md border border-border bg-card p-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto]"
                                      >
                                        <div>
                                          <label htmlFor={`split-category-${transaction.id}-${line.draft_id}`} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Category
                                          </label>
                                          <select
                                            id={`split-category-${transaction.id}-${line.draft_id}`}
                                            value={line.category_id ?? UNCATEGORIZED_VALUE}
                                            disabled={isSplitSaving}
                                            onChange={(event) => {
                                              const next = event.target.value
                                              updateSplitLine(transaction.id, line.draft_id, {
                                                category_id: next === UNCATEGORIZED_VALUE ? null : next,
                                              })
                                            }}
                                            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
                                            {categories.map((category) => (
                                              <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label htmlFor={`split-amount-${transaction.id}-${line.draft_id}`} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Amount
                                          </label>
                                          <input
                                            id={`split-amount-${transaction.id}-${line.draft_id}`}
                                            type="number"
                                            step="0.01"
                                            value={line.amount_input}
                                            disabled={isSplitSaving}
                                            onChange={(event) => updateSplitLine(transaction.id, line.draft_id, { amount_input: event.target.value })}
                                            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          />
                                        </div>
                                        <div>
                                          <label htmlFor={`split-memo-${transaction.id}-${line.draft_id}`} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Memo
                                          </label>
                                          <input
                                            id={`split-memo-${transaction.id}-${line.draft_id}`}
                                            type="text"
                                            value={line.memo}
                                            disabled={isSplitSaving}
                                            onChange={(event) => updateSplitLine(transaction.id, line.draft_id, { memo: event.target.value })}
                                            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          />
                                        </div>
                                        <div className="flex items-end">
                                          <button
                                            type="button"
                                            disabled={isSplitSaving || splitDraft.length <= 1}
                                            onClick={() => removeSplitLine(transaction.id, line.draft_id)}
                                            className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => addSplitLine(transaction)}
                                      disabled={isSplitSaving}
                                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Add split line
                                    </button>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {hasSplits ? (
                                        <button
                                          type="button"
                                          onClick={() => void clearSplitDraft(transaction)}
                                          disabled={isSplitSaving}
                                          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Clear splits
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => void saveSplitDraft(transaction)}
                                        disabled={isSplitSaving || !splitValid}
                                        className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {isSplitSaving ? 'Saving...' : 'Save splits'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ]
                    })}
                  </tbody>
                </table>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border pt-3">
                  <p className="text-sm text-muted-foreground">
                    Page {Math.min(page, totalPages)} of {totalPages}
                  </p>
                  <nav className="flex items-center gap-2" aria-label="Transactions pagination">
                    <button
                      type="button"
                      onClick={handlePreviousPage}
                      disabled={fetching || !hasPreviousPage || bulkUpdating}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={fetching || !hasNextPage || bulkUpdating}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── rule modal ────────────────────────────────────────────────────── */}
      {ruleModalTransaction && (
        <CreateRuleModal
          transaction={ruleModalTransaction}
          ruleForm={ruleForm}
          ruleModalError={ruleModalError}
          ruleModalSubmitting={ruleModalSubmitting}
          categories={categories}
          accounts={accounts}
          accountNameById={accountNameById}
          onClose={closeRuleModal}
          onFormChange={(updates) => setRuleForm((current) => ({ ...current, ...updates }))}
          onSubmit={() => void createRuleFromTransaction()}
        />
      )}

      {/* ── category follow-up banner ─────────────────────────────────────── */}
      {categoryFollowUpPrompt && (
        <CategoryFollowUpBanner
          prompt={categoryFollowUpPrompt}
          accountNameById={accountNameById}
          onDismiss={dismissCategoryFollowUpPrompt}
          onAccountScopeToggle={toggleCategoryFollowUpAccountScope}
          onApplySimilar={() => void applyCategoryToSimilar()}
          onApplyAndCreateRule={() => void applyAndCreateRule()}
        />
      )}

      {/* ── hide follow-up banner ─────────────────────────────────────────── */}
      {hideFollowUp && (
        <HideFollowUpBanner
          hideFollowUp={hideFollowUp}
          accountNameById={accountNameById}
          onDismiss={() => setHideFollowUp(null)}
          onAccountScopeToggle={(checked) =>
            setHideFollowUp((current) => (current ? { ...current, includeAccountScope: checked } : current))
          }
          onHideEverywhere={() => void hideEverywhereAndCreateRule()}
        />
      )}

      {/* ── create category modal ─────────────────────────────────────────── */}
      {createCategoryForTxnId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-category-title"
        >
          <div ref={createCategoryModalRef} tabIndex={-1} className="w-full max-w-sm rounded-xl border border bg-card p-5 shadow-xl">
            <h3 id="create-category-title" className="text-lg font-semibold text-foreground">New category</h3>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => { e.preventDefault(); void createCategory() }}
            >
              <input
                ref={createCategoryInputRef}
                type="text"
                value={createCategoryName}
                onChange={(e) => setCreateCategoryName(e.target.value)}
                placeholder="Category name"
                disabled={createCategorySubmitting}
                className="w-full rounded-md border border px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              {createCategoryError && (
                <p className="text-sm text-rose-600">{createCategoryError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={createCategorySubmitting}
                  onClick={closeCreateCategoryModal}
                  className="min-h-11 rounded-md border border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 md:py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategorySubmitting || !createCategoryName.trim()}
                  className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 md:py-1.5"
                >
                  {createCategorySubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          key={toast.id}
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.tone === 'error'
              ? 'border border-rose-300 bg-rose-50 text-rose-700'
              : 'border border-primary/30 bg-primary/10 text-primary'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
          {toast.link && (
            <Link to={toast.link.href} className="ml-1 underline font-medium" onClick={() => setToast(null)}>
              {toast.link.label}
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
