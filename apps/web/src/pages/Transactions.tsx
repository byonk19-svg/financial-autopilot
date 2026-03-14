import { CategoryFollowUpBanner } from '@/components/transactions/CategoryFollowUpBanner'
import { CreateCategoryModal } from '@/components/transactions/CreateCategoryModal'
import { CreateRuleModal } from '@/components/transactions/CreateRuleModal'
import { HideFollowUpBanner } from '@/components/transactions/HideFollowUpBanner'
import { TransactionsFiltersPanel } from '@/components/transactions/TransactionsFiltersPanel'
import { TransactionsResultsTable } from '@/components/transactions/TransactionsResultsTable'
import { TransactionsToast } from '@/components/transactions/TransactionsToast'
import { useTransactions } from '@/hooks/useTransactions'

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
    accountById,
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

  const openCreateCategoryModal = (transactionId: string) => {
    setCreateCategoryForTxnId(transactionId)
    setCreateCategoryName('')
    setCreateCategoryError('')
  }

  const closeCreateCategoryModal = () => {
    setCreateCategoryForTxnId(null)
    setCreateCategoryName('')
    setCreateCategoryError('')
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 lg:space-y-6" aria-busy={fetching} data-testid="transactions-page">
      <TransactionsFiltersPanel
        accounts={accounts}
        activeFilterChips={activeFilterChips}
        categories={categories}
        accountFilter={accountFilter}
        categoryFilter={categoryFilter}
        clearAllFilters={clearAllFilters}
        endDate={endDate}
        handleAccountFilterChange={handleAccountFilterChange}
        handleCategoryFilterChange={handleCategoryFilterChange}
        handleEndDateChange={handleEndDateChange}
        handleSearchChange={handleSearchChange}
        handleStartDateChange={handleStartDateChange}
        handleViewPresetChange={handleViewPresetChange}
        hasActiveFilters={hasActiveFilters}
        removeFilterChip={removeFilterChip}
        search={search}
        setShowHidden={setShowHidden}
        setShowPending={setShowPending}
        showHidden={showHidden}
        showPending={showPending}
        startDate={startDate}
        totalCount={totalCount}
        viewPreset={viewPreset}
      />

      <TransactionsResultsTable
        accountById={accountById}
        accountNameById={accountNameById}
        allVisibleSelected={allVisibleSelected}
        applyBulkCategoryUpdate={applyBulkCategoryUpdate}
        bulkUpdating={bulkUpdating}
        categories={categories}
        categoryNameById={categoryNameById}
        categoryUpdatingIds={categoryUpdatingIds}
        error={error}
        expandedTransactionIds={expandedTransactionIds}
        fetching={fetching}
        handleNextPage={handleNextPage}
        handlePreviousPage={handlePreviousPage}
        handleSortChange={handleSortChange}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        onOpenCreateCategory={openCreateCategoryModal}
        openRuleModal={openRuleModal}
        page={page}
        saveSplitDraft={saveSplitDraft}
        selectedCount={selectedCount}
        selectVisibleRef={selectVisibleRef}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        splitDraftsByTransactionId={splitDraftsByTransactionId}
        splitRowsByTransactionId={splitRowsByTransactionId}
        splitSavingIds={splitSavingIds}
        toggleAllVisible={toggleAllVisible}
        toggleOne={toggleOne}
        toggleTransactionDetails={toggleTransactionDetails}
        totalCount={totalCount}
        totalPages={totalPages}
        transactions={transactions}
        updateSplitLine={updateSplitLine}
        updateTransactionCategory={updateTransactionCategory}
        addSplitLine={addSplitLine}
        clearSplitDraft={clearSplitDraft}
        hideTransaction={hideTransaction}
        isSelected={isSelected}
        removeSplitLine={removeSplitLine}
      />

      {ruleModalTransaction ? (
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
          onSubmit={() => {
            void createRuleFromTransaction()
          }}
        />
      ) : null}

      {categoryFollowUpPrompt ? (
        <CategoryFollowUpBanner
          prompt={categoryFollowUpPrompt}
          accountNameById={accountNameById}
          onDismiss={dismissCategoryFollowUpPrompt}
          onAccountScopeToggle={toggleCategoryFollowUpAccountScope}
          onApplySimilar={() => {
            void applyCategoryToSimilar()
          }}
          onApplyAndCreateRule={() => {
            void applyAndCreateRule()
          }}
        />
      ) : null}

      {hideFollowUp ? (
        <HideFollowUpBanner
          hideFollowUp={hideFollowUp}
          accountNameById={accountNameById}
          onDismiss={() => setHideFollowUp(null)}
          onAccountScopeToggle={(checked) => {
            setHideFollowUp((current) => (current ? { ...current, includeAccountScope: checked } : current))
          }}
          onHideEverywhere={() => {
            void hideEverywhereAndCreateRule()
          }}
        />
      ) : null}

      {createCategoryForTxnId ? (
        <CreateCategoryModal
          createCategoryError={createCategoryError}
          createCategoryName={createCategoryName}
          createCategorySubmitting={createCategorySubmitting}
          onClose={closeCreateCategoryModal}
          onCreate={createCategory}
          onNameChange={setCreateCategoryName}
        />
      ) : null}

      {toast ? <TransactionsToast toast={toast} onDismiss={() => setToast(null)} /> : null}
    </main>
  )
}
