import { AlertCard } from '@/components/alerts/AlertCard'
import { useAlerts } from '@/hooks/useAlerts'
import type { AlertSeverityFilter, AlertTypeFilter } from '@/lib/types'

const ALERT_TYPE_OPTIONS: Array<{ value: AlertTypeFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'unusual_charge', label: 'Unusual charge' },
  { value: 'duplicate_charge', label: 'Duplicate charge' },
  { value: 'subscription_increase', label: 'Subscription increase' },
  { value: 'pace_warning', label: 'Pace warning' },
  { value: 'bill_spike', label: 'Bill spike' },
  { value: 'subscription_renewal', label: 'Subscription renewal' },
]

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function Alerts() {
  const {
    alerts,
    fetching,
    error,
    updatingId,
    bulkUpdating,
    unreadOnly,
    setUnreadOnly,
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    selectedIds,
    selectedIdSet,
    expandedIds,
    feedbackByKey,
    allVisibleSelected,
    markRead,
    dismissAlert,
    toggleSelectAlert,
    toggleSelectVisible,
    clearFilters,
    toggleReasoning,
    getFeedbackKeyForAlert,
    removeFeedback,
    submitFeedback,
    runBulkMarkRead,
    runBulkDismiss,
  } = useAlerts()

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {alerts.length}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Unusual charges, anomalies, and price increases flagged by the system. Dismiss or mark as
          expected.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              className="h-4 w-4 rounded border border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            Unread only
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted-foreground">
            Severity
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as AlertSeverityFilter)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted-foreground">
            Alert type
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as AlertTypeFilter)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ALERT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end justify-start md:justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{selectedIds.length} selected</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runBulkMarkRead()}
                disabled={bulkUpdating !== '' || updatingId !== ''}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkUpdating === 'read' ? 'Updating...' : 'Mark selected read'}
              </button>
              <button
                type="button"
                onClick={() => void runBulkDismiss()}
                disabled={bulkUpdating !== '' || updatingId !== ''}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkUpdating === 'dismiss' ? 'Updating...' : 'Dismiss selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!fetching && alerts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectVisible}
              className="h-4 w-4 rounded border border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            Select all visible
          </label>
        </div>
      )}

      <div className="space-y-3">
        {fetching ? (
          Array.from({ length: 3 }).map((_, index) => (
            <article key={index} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-14 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-3 w-11/12 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-8/12 animate-pulse rounded bg-muted" />
              <div className="mt-5 flex gap-2">
                <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
                <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
              </div>
            </article>
          ))
        ) : alerts.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <CheckCircleIcon className="h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-base font-medium text-foreground">All clear - no active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const feedbackKey = getFeedbackKeyForAlert(alert)
            return (
              <AlertCard
                key={alert.id}
                alert={alert}
                isSelected={selectedIdSet.has(alert.id)}
                isExpanded={expandedIds.includes(alert.id)}
                isUpdating={updatingId === alert.id}
                isBulkUpdating={bulkUpdating !== ''}
                feedback={feedbackByKey[feedbackKey]}
                onSelect={toggleSelectAlert}
                onMarkRead={markRead}
                onDismiss={dismissAlert}
                onSubmitFeedback={submitFeedback}
                onRemoveFeedback={removeFeedback}
                onToggleReasoning={toggleReasoning}
              />
            )
          })
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
