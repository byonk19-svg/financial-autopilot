import type { RefObject } from 'react'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronRight } from 'lucide-react'
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
import {
  isSplitTotalValid,
  parseAmount,
  parseAmountInput,
  resolveRuleId,
  UNCATEGORIZED_VALUE,
} from '@/hooks/useTransactions.helpers'
import type {
  AccountOption,
  CategoryOption,
  SortColumn,
  SortDirection,
  TransactionRow,
  TransactionSplitDraftLine,
  TransactionSplitRow,
} from '@/lib/types'

type SplitLineUpdates = Partial<Pick<TransactionSplitDraftLine, 'category_id' | 'amount_input' | 'memo'>>

type TransactionsResultsTableProps = {
  accountById: Map<string, AccountOption>
  accountNameById: Map<string, string>
  allVisibleSelected: boolean
  applyBulkCategoryUpdate: (categoryId: string) => Promise<void>
  bulkUpdating: boolean
  categories: CategoryOption[]
  categoryNameById: Map<string, string>
  categoryUpdatingIds: Set<string>
  error: string
  expandedTransactionIds: Set<string>
  fetching: boolean
  handleNextPage: () => void
  handlePreviousPage: () => void
  handleSortChange: (column: SortColumn) => void
  hasNextPage: boolean
  hasPreviousPage: boolean
  onOpenCreateCategory: (transactionId: string) => void
  openRuleModal: (transaction: TransactionRow) => void
  page: number
  saveSplitDraft: (transaction: TransactionRow) => Promise<void>
  selectedCount: number
  selectVisibleRef: RefObject<HTMLInputElement>
  sortColumn: SortColumn
  sortDirection: SortDirection
  splitDraftsByTransactionId: Record<string, TransactionSplitDraftLine[]>
  splitRowsByTransactionId: Record<string, TransactionSplitRow[]>
  splitSavingIds: Set<string>
  toggleAllVisible: (checked: boolean) => void
  toggleOne: (transactionId: string, checked: boolean) => void
  toggleTransactionDetails: (transaction: TransactionRow) => void
  totalCount: number
  totalPages: number
  transactions: TransactionRow[]
  updateSplitLine: (transactionId: string, draftId: string, updates: SplitLineUpdates) => void
  updateTransactionCategory: (transactionId: string, categoryId: string) => Promise<void>
  addSplitLine: (transaction: TransactionRow) => void
  clearSplitDraft: (transaction: TransactionRow) => Promise<void>
  hideTransaction: (transaction: TransactionRow) => Promise<void>
  isSelected: (transactionId: string) => boolean
  removeSplitLine: (transactionId: string, draftId: string) => void
}

const SORTABLE_COLUMNS: Array<{ key: SortColumn; label: string }> = [
  { key: 'posted_at', label: 'Date' },
  { key: 'merchant_normalized', label: 'Merchant' },
  { key: 'amount', label: 'Amount' },
]

export function TransactionsResultsTable({
  accountById,
  accountNameById,
  allVisibleSelected,
  applyBulkCategoryUpdate,
  bulkUpdating,
  categories,
  categoryNameById,
  categoryUpdatingIds,
  error,
  expandedTransactionIds,
  fetching,
  handleNextPage,
  handlePreviousPage,
  handleSortChange,
  hasNextPage,
  hasPreviousPage,
  onOpenCreateCategory,
  openRuleModal,
  page,
  saveSplitDraft,
  selectedCount,
  selectVisibleRef,
  sortColumn,
  sortDirection,
  splitDraftsByTransactionId,
  splitRowsByTransactionId,
  splitSavingIds,
  toggleAllVisible,
  toggleOne,
  toggleTransactionDetails,
  totalCount,
  totalPages,
  transactions,
  updateSplitLine,
  updateTransactionCategory,
  addSplitLine,
  clearSplitDraft,
  hideTransaction,
  isSelected,
  removeSplitLine,
}: TransactionsResultsTableProps) {
  return (
    <section
      aria-labelledby="transactions-results-heading"
      className="section-surface"
    >
      <h2 id="transactions-results-heading" className="sr-only">Transaction results</h2>

      {fetching ? (
        <ResultsLoadingState />
      ) : error ? (
        <p className="p-6 text-sm text-rose-600" role="alert" aria-live="polite">{error}</p>
      ) : (
        <div className="p-4" aria-live="polite">
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            Showing {transactions.length} of {totalCount} transactions
          </p>

          {selectedCount > 0 ? (
            <BulkCategoryBar
              applyBulkCategoryUpdate={applyBulkCategoryUpdate}
              bulkUpdating={bulkUpdating}
              categories={categories}
              selectedCount={selectedCount}
            />
          ) : null}

          {transactions.length === 0 ? (
            <ResultsEmptyState />
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/75 bg-muted/20 px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleAllVisible(event.target.checked)}
                      disabled={transactions.length === 0 || fetching || bulkUpdating}
                      aria-label="Select visible transactions"
                      className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    Select page
                  </label>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleSortChange('posted_at')}
                      className="rounded-full border border-border/80 px-2.5 py-1 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Date
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSortChange('amount')}
                      className="rounded-full border border-border/80 px-2.5 py-1 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Amount
                    </button>
                  </div>
                </div>

                {transactions.map((transaction) => (
                  <TransactionMobileCard
                    accountById={accountById}
                    key={transaction.id}
                    accountNameById={accountNameById}
                    bulkUpdating={bulkUpdating}
                    categories={categories}
                    categoryNameById={categoryNameById}
                    categoryUpdatingIds={categoryUpdatingIds}
                    expandedTransactionIds={expandedTransactionIds}
                    onOpenCreateCategory={onOpenCreateCategory}
                    openRuleModal={openRuleModal}
                    splitDraftsByTransactionId={splitDraftsByTransactionId}
                    splitRowsByTransactionId={splitRowsByTransactionId}
                    splitSavingIds={splitSavingIds}
                    toggleOne={toggleOne}
                    toggleTransactionDetails={toggleTransactionDetails}
                    transaction={transaction}
                    updateSplitLine={updateSplitLine}
                    updateTransactionCategory={updateTransactionCategory}
                    addSplitLine={addSplitLine}
                    clearSplitDraft={clearSplitDraft}
                    hideTransaction={hideTransaction}
                    isSelected={isSelected}
                    removeSplitLine={removeSplitLine}
                    saveSplitDraft={saveSplitDraft}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-border text-[13px] leading-5">
                  <thead className="sticky top-0 z-10 bg-muted/95 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
                    <tr>
                      <th className="w-10 px-2.5 py-2 lg:w-11 lg:px-3 xl:w-12 xl:px-4 xl:py-2.5">
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
                      {SORTABLE_COLUMNS.map(({ key, label }) => (
                        <th
                          key={key}
                          className={`px-2.5 py-2 lg:px-3 xl:px-4 xl:py-2.5 ${key === 'amount' ? 'text-right' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSortChange(key)}
                            className={`inline-flex items-center gap-1 rounded-sm px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${key === 'amount' ? 'ml-auto' : ''}`}
                          >
                            {label}
                            {sortColumn === key ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" aria-hidden="true" />
                            )}
                          </button>
                        </th>
                      ))}
                      <th className="hidden px-3 py-2 xl:table-cell xl:px-4 xl:py-2.5">Description</th>
                      <th className="px-2.5 py-2 lg:px-3 xl:px-4 xl:py-2.5">Category</th>
                      <th className="px-2.5 py-2 lg:px-3 xl:px-4 xl:py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((transaction) => (
                      <TransactionRowGroup
                        accountById={accountById}
                        key={transaction.id}
                        accountNameById={accountNameById}
                        bulkUpdating={bulkUpdating}
                        categories={categories}
                        categoryNameById={categoryNameById}
                        categoryUpdatingIds={categoryUpdatingIds}
                        expandedTransactionIds={expandedTransactionIds}
                        onOpenCreateCategory={onOpenCreateCategory}
                        openRuleModal={openRuleModal}
                        splitDraftsByTransactionId={splitDraftsByTransactionId}
                        splitRowsByTransactionId={splitRowsByTransactionId}
                        splitSavingIds={splitSavingIds}
                        toggleOne={toggleOne}
                        toggleTransactionDetails={toggleTransactionDetails}
                        transaction={transaction}
                        updateSplitLine={updateSplitLine}
                        updateTransactionCategory={updateTransactionCategory}
                        addSplitLine={addSplitLine}
                        clearSplitDraft={clearSplitDraft}
                        hideTransaction={hideTransaction}
                        isSelected={isSelected}
                        removeSplitLine={removeSplitLine}
                        saveSplitDraft={saveSplitDraft}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {Math.min(page, totalPages)} of {totalPages}
                </p>
                <nav className="flex w-full items-center gap-2 sm:w-auto" aria-label="Transactions pagination">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={fetching || !hasPreviousPage || bulkUpdating}
                    className="min-h-11 flex-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:flex-none"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={fetching || !hasNextPage || bulkUpdating}
                    className="min-h-11 flex-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:flex-none"
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
  )
}

type BulkCategoryBarProps = {
  applyBulkCategoryUpdate: (categoryId: string) => Promise<void>
  bulkUpdating: boolean
  categories: CategoryOption[]
  selectedCount: number
}

function BulkCategoryBar({
  applyBulkCategoryUpdate,
  bulkUpdating,
  categories,
  selectedCount,
}: BulkCategoryBarProps) {
  return (
    <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-[0_16px_34px_-28px_hsl(var(--foreground)/0.4)] lg:static lg:rounded-lg lg:bg-muted/40 lg:py-2 lg:shadow-none">
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
                onClick={() => {
                  void applyBulkCategoryUpdate(category.id)
                }}
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
          onClick={() => {
            void applyBulkCategoryUpdate(UNCATEGORIZED_VALUE)
          }}
          disabled={bulkUpdating}
          className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear category
        </button>
      </div>
    </div>
  )
}

function ResultsLoadingState() {
  return (
    <div className="p-4" aria-live="polite" aria-busy="true">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-7 gap-4 border-b border bg-muted px-4 py-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-7 gap-4 px-4 py-3">
              {Array.from({ length: 7 }).map((_, cellIndex) => (
                <div key={cellIndex} className="h-3 w-20 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ResultsEmptyState() {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border bg-muted/30 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-muted-foreground/60" aria-hidden="true">
        <path
          d="M8 8h8M8 12h8M8 16h5M6 3h9l3 3v15H6z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="mt-3 text-base font-medium text-foreground">No transactions match your filters</p>
      <p className="mt-1 text-sm text-muted-foreground">Try widening date range, account, category, or search.</p>
    </div>
  )
}

// ─── TransactionDetailsPanel ──────────────────────────────────────────────────
// Expanded row panel: metadata, category edit, hide button, split editor.
// Extracted to keep TransactionRowGroup focused on the summary table row only.

type TransactionDetailsPanelProps = {
  transaction: TransactionRow
  amount: number
  accountName: string
  accountType: string
  creditAccountLabel: string
  matchedRuleId: string | null
  categoryName: string | null
  localCategoryValue: string
  isCategoryUpdating: boolean
  bulkUpdating: boolean
  categories: CategoryOption[]
  splitDraft: TransactionSplitDraftLine[]
  splitRows: TransactionSplitRow[]
  splitTotal: number
  splitBalanceDelta: number
  splitValid: boolean
  isSplitSaving: boolean
  hasSplits: boolean
  splitCount: number
  updateTransactionCategory: (transactionId: string, categoryId: string) => Promise<void>
  openRuleModal: (transaction: TransactionRow) => void
  hideTransaction: (transaction: TransactionRow) => Promise<void>
  updateSplitLine: (transactionId: string, draftId: string, updates: SplitLineUpdates) => void
  addSplitLine: (transaction: TransactionRow) => void
  removeSplitLine: (transactionId: string, draftId: string) => void
  saveSplitDraft: (transaction: TransactionRow) => Promise<void>
  clearSplitDraft: (transaction: TransactionRow) => Promise<void>
}

type TransactionDetailsContentProps = TransactionDetailsPanelProps & {
  className?: string
}

function TransactionDetailsContent({
  transaction, amount, accountName, accountType, creditAccountLabel, matchedRuleId,
  categoryName, localCategoryValue, isCategoryUpdating, bulkUpdating, categories,
  splitDraft, splitTotal, splitBalanceDelta, splitValid, isSplitSaving, hasSplits,
  updateTransactionCategory, openRuleModal, hideTransaction, updateSplitLine,
  addSplitLine, removeSplitLine, saveSplitDraft, clearSplitDraft, className = '',
}: TransactionDetailsContentProps & { colSpan?: never }) {
  const rawMerchant = transaction.merchant_normalized ?? 'Not available'
  const rawDescription = transaction.description_full ?? transaction.description_short ?? 'Not available'
  const categorySource = transaction.category_source ?? null
  const transactionType = transaction.type ?? 'Not available'
  const pendingLabel =
    typeof transaction.is_pending === 'boolean' ? (transaction.is_pending ? 'Pending' : 'Posted') : 'Unknown'

  return (
    <div className={`rounded-xl border border-border/75 bg-muted/20 p-3 xl:p-4 ${className}`}>
      {/* Metadata grid */}
      <div className="grid gap-2.5 text-[13px] leading-5 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Raw merchant</p>
          <p className="mt-1 break-words text-foreground">{rawMerchant}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Raw description</p>
          <p className="mt-1 break-words text-foreground">{rawDescription}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Account</p>
          <p className="mt-1 break-words text-foreground">{accountName}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Account type</p>
          <p className="mt-1 text-foreground">{accountType}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Credit account</p>
          <p className="mt-1 text-foreground">{creditAccountLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Amount</p>
          <p className={`mt-1 ${amount < 0 ? 'font-medium text-emerald-600' : 'text-foreground'}`}>
            {amount.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Date</p>
          <p className="mt-1 text-foreground">{format(new Date(transaction.posted_at), 'yyyy-MM-dd HH:mm')}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Category source</p>
          <p className="mt-1 text-foreground">{categorySource ?? 'Not available'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Transaction type</p>
          <p className="mt-1 text-foreground">{transactionType}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status</p>
          <p className="mt-1 text-foreground">{pendingLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Category</p>
          <p className="mt-1 text-foreground">{categoryName ?? 'Uncategorized'}</p>
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Matched rule</p>
          {matchedRuleId ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-foreground">Rule {matchedRuleId}</span>
              <Link
                to={`/rules?ruleId=${matchedRuleId}`}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Open in Rules
              </Link>
            </div>
          ) : (
            <p className="mt-1 text-foreground">No matched rule</p>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="mt-4 flex flex-wrap items-end gap-2.5 border-t border pt-3">
        <div className="space-y-1">
          <label htmlFor={`transaction-detail-category-${transaction.id}`} className="text-[11px] font-medium text-muted-foreground">
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
            className="min-w-[11rem] rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
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
          className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Create rule from this transaction
        </button>
        <button
          type="button"
          onClick={() => { void hideTransaction(transaction) }}
          className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Hide this transaction
        </button>
      </div>

      {/* Split editor */}
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
                onClick={() => { void clearSplitDraft(transaction) }}
                disabled={isSplitSaving}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear splits
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => { void saveSplitDraft(transaction) }}
              disabled={isSplitSaving || !splitValid}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSplitSaving ? 'Saving...' : 'Save splits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TransactionDetailsPanel({ colSpan, ...props }: TransactionDetailsPanelProps & { colSpan: number }) {
  return (
    <tr id={`transaction-details-${props.transaction.id}`} className="bg-transparent">
      <td colSpan={colSpan} className="px-3 pb-3 pt-0 xl:px-4 xl:pb-4">
        <TransactionDetailsContent {...props} className="mt-0.5" />
      </td>
    </tr>
  )
}

function TransactionMobileCard(props: TransactionRowGroupProps) {
  const {
    accountById,
    accountNameById,
    bulkUpdating,
    categories,
    categoryNameById,
    categoryUpdatingIds,
    expandedTransactionIds,
    onOpenCreateCategory,
    openRuleModal,
    splitDraftsByTransactionId,
    splitRowsByTransactionId,
    splitSavingIds,
    toggleOne,
    toggleTransactionDetails,
    transaction,
    updateSplitLine,
    updateTransactionCategory,
    addSplitLine,
    clearSplitDraft,
    hideTransaction,
    isSelected,
    removeSplitLine,
    saveSplitDraft,
  } = props

  const amount = parseAmount(transaction.amount)
  const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id
  const categoryName = effectiveCategoryId ? (categoryNameById.get(effectiveCategoryId) ?? null) : null
  const localCategoryValue = transaction.category_id ?? UNCATEGORIZED_VALUE
  const isCategoryUpdating = categoryUpdatingIds.has(transaction.id)
  const isExpanded = expandedTransactionIds.has(transaction.id)
  const matchedRuleId = resolveRuleId(transaction)
  const account = accountById.get(transaction.account_id)
  const accountName = accountNameById.get(transaction.account_id) ?? 'Unknown account'
  const accountType = account?.type?.trim() || 'Not available'
  const creditAccountLabel = typeof account?.is_credit === 'boolean' ? (account.is_credit ? 'Yes' : 'No') : 'Unknown'
  const splitRows = splitRowsByTransactionId[transaction.id] ?? []
  const splitCount = splitRows.length
  const hasSplits = splitCount > 0
  const splitDraft = splitDraftsByTransactionId[transaction.id] ?? []
  const splitTotal = splitDraft.reduce((sum, line) => sum + parseAmountInput(line.amount_input), 0)
  const splitBalanceDelta = amount - splitTotal
  const splitValid = isSplitTotalValid(splitTotal, amount)
  const isSplitSaving = splitSavingIds.has(transaction.id)
  const merchantLabel = toTitleCase(
    transaction.merchant_canonical || transaction.merchant_normalized || accountNameById.get(transaction.account_id) || '-',
  )

  return (
    <article className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_16px_34px_-30px_hsl(var(--foreground)/0.35)]">
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected(transaction.id)}
            onChange={(event) => toggleOne(transaction.id, event.target.checked)}
            disabled={isCategoryUpdating || bulkUpdating}
            aria-label={`Select transaction ${transaction.id}`}
            className="mt-1 h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-foreground">{merchantLabel}</p>
                  {transaction.is_pending ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                      Pending
                    </span>
                  ) : null}
                  {hasSplits ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Split {splitCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{transaction.description_short}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(transaction.posted_at), 'MMM d, yyyy')}</span>
                  <span>{accountName}</span>
                </div>
              </div>

              <p className={`shrink-0 text-base font-semibold ${amount < 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                {amount.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
              </p>
            </div>

            <div className="space-y-2">
              {hasSplits ? (
                <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                  Split transaction. Use details below to manage categories and lines.
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isCategoryUpdating || bulkUpdating}
                      className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
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
                          {localCategoryValue === UNCATEGORIZED_VALUE ? <Check className="h-3.5 w-3.5" /> : null}
                        </div>
                      </DropdownMenuRadioItem>
                      {categories.map((category) => (
                        <DropdownMenuRadioItem key={category.id} value={category.id}>
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="truncate">{category.name}</span>
                            {localCategoryValue === category.id ? <Check className="h-3.5 w-3.5" /> : null}
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onOpenCreateCategory(transaction.id)} className="text-primary">
                      + New category...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <button
                type="button"
                onClick={() => toggleTransactionDetails(transaction)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={isExpanded}
                aria-controls={`transaction-details-mobile-${transaction.id}`}
              >
                {isExpanded ? 'Hide details' : 'Show details'}
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div id={`transaction-details-mobile-${transaction.id}`} className="border-t border-border/70 px-4 pb-4 pt-3">
          <TransactionDetailsContent
            transaction={transaction}
            amount={amount}
            accountName={accountName}
            accountType={accountType}
            creditAccountLabel={creditAccountLabel}
            matchedRuleId={matchedRuleId}
            categoryName={categoryName}
            localCategoryValue={localCategoryValue}
            isCategoryUpdating={isCategoryUpdating}
            bulkUpdating={bulkUpdating}
            categories={categories}
            splitDraft={splitDraft}
            splitRows={splitRows}
            splitTotal={splitTotal}
            splitBalanceDelta={splitBalanceDelta}
            splitValid={splitValid}
            isSplitSaving={isSplitSaving}
            hasSplits={hasSplits}
            splitCount={splitCount}
            updateTransactionCategory={updateTransactionCategory}
            openRuleModal={openRuleModal}
            hideTransaction={hideTransaction}
            updateSplitLine={updateSplitLine}
            addSplitLine={addSplitLine}
            removeSplitLine={removeSplitLine}
            saveSplitDraft={saveSplitDraft}
            clearSplitDraft={clearSplitDraft}
          />
        </div>
      ) : null}
    </article>
  )
}

// ─── TransactionRowGroup ───────────────────────────────────────────────────────
// Summary <tr> + expanded details panel for one transaction.

type TransactionRowGroupProps = {
  accountById: Map<string, AccountOption>
  accountNameById: Map<string, string>
  bulkUpdating: boolean
  categories: CategoryOption[]
  categoryNameById: Map<string, string>
  categoryUpdatingIds: Set<string>
  expandedTransactionIds: Set<string>
  onOpenCreateCategory: (transactionId: string) => void
  openRuleModal: (transaction: TransactionRow) => void
  splitDraftsByTransactionId: Record<string, TransactionSplitDraftLine[]>
  splitRowsByTransactionId: Record<string, TransactionSplitRow[]>
  splitSavingIds: Set<string>
  toggleOne: (transactionId: string, checked: boolean) => void
  toggleTransactionDetails: (transaction: TransactionRow) => void
  transaction: TransactionRow
  updateSplitLine: (transactionId: string, draftId: string, updates: SplitLineUpdates) => void
  updateTransactionCategory: (transactionId: string, categoryId: string) => Promise<void>
  addSplitLine: (transaction: TransactionRow) => void
  clearSplitDraft: (transaction: TransactionRow) => Promise<void>
  hideTransaction: (transaction: TransactionRow) => Promise<void>
  isSelected: (transactionId: string) => boolean
  removeSplitLine: (transactionId: string, draftId: string) => void
  saveSplitDraft: (transaction: TransactionRow) => Promise<void>
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function TransactionRowGroup({
  accountById,
  accountNameById,
  bulkUpdating,
  categories,
  categoryNameById,
  categoryUpdatingIds,
  expandedTransactionIds,
  onOpenCreateCategory,
  openRuleModal,
  splitDraftsByTransactionId,
  splitRowsByTransactionId,
  splitSavingIds,
  toggleOne,
  toggleTransactionDetails,
  transaction,
  updateSplitLine,
  updateTransactionCategory,
  addSplitLine,
  clearSplitDraft,
  hideTransaction,
  isSelected,
  removeSplitLine,
  saveSplitDraft,
}: TransactionRowGroupProps) {
  const amount = parseAmount(transaction.amount)
  const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id
  const categoryName = effectiveCategoryId ? (categoryNameById.get(effectiveCategoryId) ?? null) : null
  const localCategoryValue = transaction.category_id ?? UNCATEGORIZED_VALUE
  const isCategoryUpdating = categoryUpdatingIds.has(transaction.id)
  const isExpanded = expandedTransactionIds.has(transaction.id)
  const matchedRuleId = resolveRuleId(transaction)
  const account = accountById.get(transaction.account_id)
  const accountName = accountNameById.get(transaction.account_id) ?? 'Unknown account'
  const accountType = account?.type?.trim() || 'Not available'
  const creditAccountLabel = typeof account?.is_credit === 'boolean' ? (account.is_credit ? 'Yes' : 'No') : 'Unknown'
  const splitRows = splitRowsByTransactionId[transaction.id] ?? []
  const splitCount = splitRows.length
  const hasSplits = splitCount > 0
  const splitDraft = splitDraftsByTransactionId[transaction.id] ?? []
  const splitTotal = splitDraft.reduce((sum, line) => sum + parseAmountInput(line.amount_input), 0)
  const splitBalanceDelta = amount - splitTotal
  const splitValid = isSplitTotalValid(splitTotal, amount)
  const isSplitSaving = splitSavingIds.has(transaction.id)

  return (
    <>
      <tr className="transition-colors hover:bg-muted/35">
        <td className="px-2.5 py-2 lg:px-3 xl:px-4 xl:py-2.5">
          <input
            type="checkbox"
            checked={isSelected(transaction.id)}
            onChange={(event) => toggleOne(transaction.id, event.target.checked)}
            disabled={isCategoryUpdating || bulkUpdating}
            aria-label={`Select transaction ${transaction.id}`}
            className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </td>
        <td className="px-2.5 py-2 text-[12px] text-muted-foreground lg:px-3 xl:px-4 xl:py-2.5">
          {format(new Date(transaction.posted_at), 'yyyy-MM-dd')}
        </td>
        <td className="max-w-[14rem] truncate px-2.5 py-2 font-medium text-foreground lg:px-3 xl:max-w-[18rem] xl:px-4 xl:py-2.5">
          {toTitleCase(transaction.merchant_canonical || transaction.merchant_normalized || accountNameById.get(transaction.account_id) || '-')}
        </td>
        <td className={`numeric-align px-2.5 py-2 lg:px-3 xl:px-4 xl:py-2.5 ${amount < 0 ? 'font-semibold text-emerald-600' : 'text-foreground'}`}>
          {amount.toLocaleString(undefined, { style: 'currency', currency: transaction.currency || 'USD' })}
        </td>
        <td className="hidden px-3 py-2 text-[12px] text-muted-foreground xl:table-cell xl:px-4 xl:py-2.5">{transaction.description_short}</td>
        <td className="px-2.5 py-2 text-muted-foreground lg:px-3 xl:px-4 xl:py-2.5">
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
                  className="inline-flex min-w-[8.5rem] items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-[13px] text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 xl:min-w-[10rem]"
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
                      {localCategoryValue === UNCATEGORIZED_VALUE ? <Check className="h-3.5 w-3.5" /> : null}
                    </div>
                  </DropdownMenuRadioItem>
                  {categories.map((category) => (
                    <DropdownMenuRadioItem key={category.id} value={category.id}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="truncate">{category.name}</span>
                        {localCategoryValue === category.id ? <Check className="h-3.5 w-3.5" /> : null}
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onOpenCreateCategory(transaction.id)} className="text-primary">
                  + New category...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
        <td className="px-2.5 py-2 lg:px-3 xl:px-4 xl:py-2.5">
          <button
            type="button"
            onClick={() => toggleTransactionDetails(transaction)}
            className="inline-flex items-center gap-1 rounded-md border border-border/80 px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={isExpanded}
            aria-controls={`transaction-details-${transaction.id}`}
          >
            Details
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </td>
      </tr>
      {isExpanded ? (
        <TransactionDetailsPanel
          transaction={transaction}
          colSpan={7}
          amount={amount}
          accountName={accountName}
          accountType={accountType}
          creditAccountLabel={creditAccountLabel}
          matchedRuleId={matchedRuleId}
          categoryName={categoryName}
          localCategoryValue={localCategoryValue}
          isCategoryUpdating={isCategoryUpdating}
          bulkUpdating={bulkUpdating}
          categories={categories}
          splitDraft={splitDraft}
          splitRows={splitRows}
          splitTotal={splitTotal}
          splitBalanceDelta={splitBalanceDelta}
          splitValid={splitValid}
          isSplitSaving={isSplitSaving}
          hasSplits={hasSplits}
          splitCount={splitCount}
          updateTransactionCategory={updateTransactionCategory}
          openRuleModal={openRuleModal}
          hideTransaction={hideTransaction}
          updateSplitLine={updateSplitLine}
          addSplitLine={addSplitLine}
          removeSplitLine={removeSplitLine}
          saveSplitDraft={saveSplitDraft}
          clearSplitDraft={clearSplitDraft}
        />
      ) : null}
    </>
  )
}
