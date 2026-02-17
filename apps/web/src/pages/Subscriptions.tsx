import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SubscriptionEmptyState, SubscriptionNoMatches } from '@/components/subscriptions/SubscriptionEmptyState'
import { SubscriptionFilters } from '@/components/subscriptions/SubscriptionFilters'
import { SubscriptionLoadingSkeleton } from '@/components/subscriptions/SubscriptionLoadingSkeleton'
import { SubscriptionSection } from '@/components/subscriptions/SubscriptionSection'
import { SubscriptionStats } from '@/components/subscriptions/SubscriptionStats'
import { useSubscriptions } from '@/hooks/useSubscriptions'
import { useSession } from '@/lib/session'

export default function Subscriptions() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const {
    fetching,
    processingId,
    error,
    searchQuery,
    cadenceFilter,
    priceIncreaseOnly,
    showIgnored,
    rerunningDetection,
    density,
    allReviewRows,
    subscriptionRows,
    billAndLoanRows,
    transferRows,
    reviewRows,
    ignoredRows,
    monthlySubscriptionsTotal,
    billsAndLoansTotal,
    nextSevenDaysSummary,
    flaggedIncreases,
    hasFiltersApplied,
    isEmptyData,
    isNoMatches,
    setSearchQuery,
    setCadenceFilter,
    setPriceIncreaseOnly,
    setShowIgnored,
    setDensity,
    clearFilters,
    markInactive,
    setClassification,
    updateNotifyDaysBefore,
    toggleClassificationLock,
    undoClassification,
    rerunDetection,
    markFalsePositive,
    loadSubscriptionHistory,
    historyBySubscriptionId,
    historyLoadingIds,
  } = useSubscriptions(session?.user?.id)

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
    }
  }, [loading, navigate, session])

  const handleRerunDetectionClick = useCallback(() => {
    void rerunDetection()
  }, [rerunDetection])

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden" aria-busy={fetching || rerunningDetection}>
      <section aria-labelledby="subscriptions-heading">
        <SubscriptionStats
          monthlySubscriptionsTotal={monthlySubscriptionsTotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          billsAndLoansTotal={billsAndLoansTotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          nextSevenDaysCount={nextSevenDaysSummary.count}
          nextSevenDaysAmount={nextSevenDaysSummary.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          flaggedIncreases={flaggedIncreases}
          reviewCount={allReviewRows.length}
          loading={fetching}
        />
      </section>

      {!fetching && (
        <section aria-labelledby="subscriptions-filters-heading">
          <h2 id="subscriptions-filters-heading" className="sr-only">Recurring filters</h2>
          <SubscriptionFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cadenceFilter={cadenceFilter}
            onCadenceChange={setCadenceFilter}
            priceIncreaseOnly={priceIncreaseOnly}
            onPriceIncreaseOnlyChange={setPriceIncreaseOnly}
            showIgnored={showIgnored}
            onShowIgnoredChange={setShowIgnored}
            density={density}
            onDensityChange={setDensity}
            hasFiltersApplied={hasFiltersApplied}
            onClearFilters={clearFilters}
          />
        </section>
      )}

      {fetching ? (
        <SubscriptionLoadingSkeleton density={density} />
      ) : isEmptyData ? (
        <SubscriptionEmptyState rerunningDetection={rerunningDetection} onRerunDetection={handleRerunDetectionClick} />
      ) : isNoMatches ? (
        <SubscriptionNoMatches hasFiltersApplied={hasFiltersApplied} onClearFilters={clearFilters} />
      ) : (
        <section className="space-y-4" aria-labelledby="subscriptions-sections-heading">
          <h2 id="subscriptions-sections-heading" className="sr-only">Recurring pattern sections</h2>
          <SubscriptionSection title="Subscriptions" description="Streaming, apps, and service subscriptions." emptyText="No active subscriptions found." rows={subscriptionRows} processingId={processingId} onMarkInactive={markInactive} onSetClassification={setClassification} onUpdateNotifyDaysBefore={updateNotifyDaysBefore} onToggleClassificationLock={toggleClassificationLock} onUndoClassification={undoClassification} onMarkFalsePositive={markFalsePositive} onLoadHistory={loadSubscriptionHistory} historyBySubscriptionId={historyBySubscriptionId} historyLoadingIds={historyLoadingIds} density={density} />
          <SubscriptionSection title="Bills/Loans" description="Fixed obligations such as utilities, insurance, and loan payments." emptyText="No active bills or loans found." rows={billAndLoanRows} processingId={processingId} onMarkInactive={markInactive} onSetClassification={setClassification} onUpdateNotifyDaysBefore={updateNotifyDaysBefore} onToggleClassificationLock={toggleClassificationLock} onUndoClassification={undoClassification} onMarkFalsePositive={markFalsePositive} onLoadHistory={loadSubscriptionHistory} historyBySubscriptionId={historyBySubscriptionId} historyLoadingIds={historyLoadingIds} density={density} />
          <SubscriptionSection title="Transfers" description="Recurring transfer patterns." emptyText="No recurring transfers found." rows={transferRows} processingId={processingId} onMarkInactive={markInactive} onSetClassification={setClassification} onUpdateNotifyDaysBefore={updateNotifyDaysBefore} onToggleClassificationLock={toggleClassificationLock} onUndoClassification={undoClassification} onMarkFalsePositive={markFalsePositive} onLoadHistory={loadSubscriptionHistory} historyBySubscriptionId={historyBySubscriptionId} historyLoadingIds={historyLoadingIds} density={density} />
          <SubscriptionSection title="Needs Review" description="Only recurring candidates still awaiting your decision." emptyText="No low-confidence candidates to review." rows={reviewRows} processingId={processingId} onMarkInactive={markInactive} onSetClassification={setClassification} onUpdateNotifyDaysBefore={updateNotifyDaysBefore} onToggleClassificationLock={toggleClassificationLock} onUndoClassification={undoClassification} onMarkFalsePositive={markFalsePositive} onLoadHistory={loadSubscriptionHistory} historyBySubscriptionId={historyBySubscriptionId} historyLoadingIds={historyLoadingIds} showClassifyControl density={density} />
          {showIgnored && <SubscriptionSection title="Ignored" description="Patterns marked to be ignored." emptyText="No ignored recurring patterns." rows={ignoredRows} processingId={processingId} onMarkInactive={markInactive} onSetClassification={setClassification} onUpdateNotifyDaysBefore={updateNotifyDaysBefore} onToggleClassificationLock={toggleClassificationLock} onUndoClassification={undoClassification} onMarkFalsePositive={markFalsePositive} onLoadHistory={loadSubscriptionHistory} historyBySubscriptionId={historyBySubscriptionId} historyLoadingIds={historyLoadingIds} density={density} />}
        </section>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </main>
  )
}
