import { toNumber } from '@/lib/subscriptionFormatters'
import type { AlertFeedback, AlertRow } from '@/lib/types'

function severityClass(severity: AlertRow['severity']): string {
  if (severity === 'high') return 'bg-rose-100 text-rose-700'
  if (severity === 'medium') return 'bg-amber-100 text-amber-700'
  return 'bg-blue-100 text-blue-700'
}

function alertTypeIcon(type: AlertRow['alert_type']) {
  if (type === 'duplicate_charge') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }
  if (type === 'subscription_increase') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <path
          d="M4 16 10 10l4 4 6-7M20 7h-4v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (type === 'pace_warning') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <path
          d="M5 16a7 7 0 1 1 14 0M12 9v4l3 1M4 16h16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (type === 'bill_spike') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <path
          d="M5 19V9M12 19V5M19 19v-8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (type === 'subscription_renewal') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.8v2.4M16 3.8v2.4M4 9h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
      <path
        d="M12 4 3.5 19h17L12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.8" r="0.8" fill="currentColor" />
    </svg>
  )
}

function humanizeReasoningKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatReasoningValue(value: unknown): string {
  if (value === null || value === undefined) return 'n/a'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => formatReasoningValue(item)).join(', ')
  try {
    return JSON.stringify(value)
  } catch {
    return 'n/a'
  }
}

type AlertCardProps = {
  alert: AlertRow
  isSelected: boolean
  isExpanded: boolean
  isUpdating: boolean
  isBulkUpdating: boolean
  feedback: AlertFeedback | undefined
  onSelect: (id: string) => void
  onMarkRead: (alert: AlertRow) => Promise<void>
  onDismiss: (alert: AlertRow) => Promise<void>
  onSubmitFeedback: (alert: AlertRow, isExpected: boolean) => Promise<void>
  onRemoveFeedback: (alert: AlertRow) => Promise<void>
  onToggleReasoning: (id: string) => void
}

export function AlertCard({
  alert,
  isSelected,
  isExpanded,
  isUpdating,
  isBulkUpdating,
  feedback,
  onSelect,
  onMarkRead,
  onDismiss,
  onSubmitFeedback,
  onRemoveFeedback,
  onToggleReasoning,
}: AlertCardProps) {
  const expectedSelected = feedback?.isExpected === true
  const falsePositiveSelected = feedback?.isExpected === false

  return (
    <article
      className={`rounded-xl border p-5 shadow-sm ${
        alert.read_at ? 'border bg-card' : 'border-primary/20 bg-primary/5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(alert.id)}
            className="h-4 w-4 rounded border border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Select alert ${alert.title}`}
            disabled={isBulkUpdating}
          />
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${severityClass(alert.severity)}`}>
            {alert.severity.toUpperCase()}
          </span>
          {alertTypeIcon(alert.alert_type)}
          {!alert.read_at && (
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
              Unread
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(alert.created_at).toLocaleString()}
        </span>
      </div>

      <h2 className="mt-3 text-lg font-semibold text-foreground">{alert.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{alert.body}</p>
      {alert.merchant_normalized && (
        <p className="mt-2 text-xs text-muted-foreground">
          Merchant: {alert.merchant_normalized}
          {alert.amount !== null &&
            ` - Amount: ${toNumber(alert.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => void onMarkRead(alert)}
          disabled={Boolean(alert.read_at) || isUpdating || isBulkUpdating}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {alert.read_at ? 'Read' : isUpdating ? 'Updating...' : 'Mark read'}
        </button>
        <button
          onClick={() => void onDismiss(alert)}
          disabled={isUpdating || isBulkUpdating}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUpdating ? 'Updating...' : 'Dismiss'}
        </button>
        <button
          onClick={() => void onSubmitFeedback(alert, true)}
          disabled={isUpdating || isBulkUpdating}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors-fast disabled:cursor-not-allowed disabled:opacity-60 ${
            expectedSelected
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border text-foreground hover:bg-muted'
          }`}
        >
          {isUpdating ? 'Saving...' : expectedSelected ? 'Expected (saved)' : 'Expected'}
        </button>
        <button
          onClick={() => void onSubmitFeedback(alert, false)}
          disabled={isUpdating || isBulkUpdating}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors-fast disabled:cursor-not-allowed disabled:opacity-60 ${
            falsePositiveSelected
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-rose-200 text-rose-700 hover:bg-rose-50'
          }`}
        >
          {isUpdating
            ? 'Saving...'
            : falsePositiveSelected
              ? 'False positive (saved)'
              : 'False positive'}
        </button>
        {feedback && (
          <button
            type="button"
            onClick={() => void onRemoveFeedback(alert)}
            disabled={isUpdating || isBulkUpdating}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdating ? 'Saving...' : 'Remove feedback'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggleReasoning(alert.id)}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
        >
          {isExpanded ? 'Hide reasoning' : 'Why did this fire?'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 rounded-lg border border-border bg-background/70 p-3">
          <h3 className="text-sm font-semibold text-foreground">Why did this fire?</h3>
          {feedback && (
            <p className="mt-2 text-xs text-muted-foreground">
              Feedback saved: {feedback.isExpected ? 'Expected' : 'False positive'} on{' '}
              {new Date(feedback.createdAt).toLocaleString()}.
            </p>
          )}
          {alert.reasoning && Object.keys(alert.reasoning).length > 0 ? (
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              {Object.entries(alert.reasoning).map(([key, value]) => (
                <div
                  key={`${alert.id}-${key}`}
                  className="rounded-md border border-border bg-card px-2 py-1.5"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {humanizeReasoningKey(key)}
                  </dt>
                  <dd className="mt-0.5 text-sm text-foreground">{formatReasoningValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No reasoning payload available for this alert.
            </p>
          )}
        </div>
      )}
    </article>
  )
}
