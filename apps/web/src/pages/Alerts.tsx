import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toNumber } from '../lib/subscriptionFormatters'
import { captureException } from '../lib/errorReporting'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type AlertRow = {
  id: string
  alert_type:
    | 'unusual_charge'
    | 'duplicate_charge'
    | 'subscription_increase'
    | 'pace_warning'
    | 'bill_spike'
    | 'subscription_renewal'
  severity: 'low' | 'medium' | 'high'
  title: string
  body: string
  merchant_normalized: string | null
  amount: number | string | null
  reasoning: Record<string, unknown> | null
  created_at: string
  read_at: string | null
  is_dismissed: boolean
}

type AlertSeverityFilter = 'all' | AlertRow['severity']
type AlertTypeFilter = 'all' | AlertRow['alert_type']

const ALERT_TYPE_OPTIONS: Array<{ value: AlertTypeFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'unusual_charge', label: 'Unusual charge' },
  { value: 'duplicate_charge', label: 'Duplicate charge' },
  { value: 'subscription_increase', label: 'Subscription increase' },
  { value: 'pace_warning', label: 'Pace warning' },
  { value: 'bill_spike', label: 'Bill spike' },
  { value: 'subscription_renewal', label: 'Subscription renewal' },
]

function toFeedbackMerchantCanonical(merchant: string | null): string {
  const normalized = (merchant ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : '__unscoped__'
}

function humanizeReasoningKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
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

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function Alerts() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState<'read' | 'dismiss' | ''>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const loadAlerts = useCallback(async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')

    let query = supabase
      .from('alerts')
      .select('id, alert_type, severity, title, body, merchant_normalized, amount, reasoning, created_at, read_at, is_dismissed')
      .eq('user_id', session.user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })

    if (unreadOnly) {
      query = query.is('read_at', null)
    }
    if (severityFilter !== 'all') {
      query = query.eq('severity', severityFilter)
    }
    if (typeFilter !== 'all') {
      query = query.eq('alert_type', typeFilter)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      captureException(fetchError, {
        component: 'Alerts',
        action: 'load-alerts',
      })
      setError('Could not load alerts.')
      setFetching(false)
      return
    }

    const rows = (data ?? []) as AlertRow[]
    setAlerts(rows)
    setExpandedIds((current) => current.filter((id) => rows.some((row) => row.id === id)))
    setSelectedIds((current) => {
      const visible = new Set(rows.map((row) => row.id))
      return current.filter((id) => visible.has(id))
    })
    setFetching(false)
  }, [session?.user, unreadOnly, severityFilter, typeFilter])

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    void loadAlerts()
  }, [loading, navigate, session, loadAlerts])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allVisibleSelected = alerts.length > 0 && alerts.every((row) => selectedIdSet.has(row.id))

  const markRead = useCallback(async (alert: AlertRow) => {
    if (!session?.user || alert.read_at) return
    setUpdatingId(alert.id)
    setError('')
    const previousAlerts = alerts
    const previousSelectedIds = selectedIds

    const readAt = new Date().toISOString()
    setAlerts((current) => current.map((row) => (row.id === alert.id ? { ...row, read_at: readAt } : row)))
    setSelectedIds((current) => current.filter((id) => id !== alert.id))

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ read_at: readAt })
      .eq('id', alert.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      captureException(updateError, {
        component: 'Alerts',
        action: 'mark-read',
        alert_id: alert.id,
      })
      setAlerts(previousAlerts)
      setSelectedIds(previousSelectedIds)
      setError('Could not mark alert as read.')
      setUpdatingId('')
      return
    }

    void loadAlerts()
    setUpdatingId('')
  }, [alerts, loadAlerts, selectedIds, session?.user])

  const dismissAlert = useCallback(async (alert: AlertRow) => {
    if (!session?.user) return
    setUpdatingId(alert.id)
    setError('')

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ is_dismissed: true })
      .eq('id', alert.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      captureException(updateError, {
        component: 'Alerts',
        action: 'dismiss-alert',
        alert_id: alert.id,
      })
      setError('Could not dismiss alert.')
      setUpdatingId('')
      return
    }

    setAlerts((current) => current.filter((row) => row.id !== alert.id))
    setSelectedIds((current) => current.filter((id) => id !== alert.id))
    setUpdatingId('')
  }, [session?.user])

  const toggleSelectAlert = useCallback((alertId: string) => {
    setSelectedIds((current) =>
      current.includes(alertId) ? current.filter((id) => id !== alertId) : [...current, alertId],
    )
  }, [])

  const toggleSelectVisible = useCallback(() => {
    const visibleIds = alerts.map((row) => row.id)
    if (visibleIds.length === 0) return

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id))
      }

      const next = new Set(current)
      for (const id of visibleIds) next.add(id)
      return [...next]
    })
  }, [alerts, allVisibleSelected])

  const clearFilters = useCallback(() => {
    setUnreadOnly(false)
    setSeverityFilter('all')
    setTypeFilter('all')
  }, [])

  const toggleReasoning = useCallback((alertId: string) => {
    setExpandedIds((current) =>
      current.includes(alertId) ? current.filter((id) => id !== alertId) : [...current, alertId],
    )
  }, [])

  const dismissAfterFeedback = useCallback(
    async (alert: AlertRow) => {
      if (!session?.user) return
      const { error: dismissError } = await supabase
        .from('alerts')
        .update({ is_dismissed: true, read_at: alert.read_at ?? new Date().toISOString() })
        .eq('id', alert.id)
        .eq('user_id', session.user.id)

      if (dismissError) {
        captureException(dismissError, {
          component: 'Alerts',
          action: 'dismiss-after-feedback',
          alert_id: alert.id,
        })
        setError('Feedback saved, but the alert could not be dismissed automatically.')
        return
      }

      setAlerts((current) => current.filter((row) => row.id !== alert.id))
      setSelectedIds((current) => current.filter((id) => id !== alert.id))
      setExpandedIds((current) => current.filter((id) => id !== alert.id))
    },
    [session?.user],
  )

  const submitFeedback = useCallback(
    async (alert: AlertRow, isExpected: boolean) => {
      if (!session?.user) return
      setUpdatingId(alert.id)
      setError('')

      const { error: feedbackError } = await supabase.from('alert_feedback').insert({
        user_id: session.user.id,
        alert_type: alert.alert_type,
        merchant_canonical: toFeedbackMerchantCanonical(alert.merchant_normalized),
        is_expected: isExpected,
      })

      if (feedbackError) {
        captureException(feedbackError, {
          component: 'Alerts',
          action: isExpected ? 'feedback-expected' : 'feedback-false-positive',
          alert_id: alert.id,
        })
        setError('Could not save feedback.')
        setUpdatingId('')
        return
      }

      await dismissAfterFeedback(alert)
      setUpdatingId('')
    },
    [dismissAfterFeedback, session?.user],
  )

  const runBulkMarkRead = useCallback(async () => {
    if (!session?.user || selectedIds.length === 0) return

    setBulkUpdating('read')
    setError('')
    const readAt = new Date().toISOString()
    const targetIds = [...selectedIds]

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ read_at: readAt })
      .eq('user_id', session.user.id)
      .in('id', targetIds)

    if (updateError) {
      captureException(updateError, {
        component: 'Alerts',
        action: 'bulk-mark-read',
      })
      setError('Could not mark selected alerts as read.')
      setBulkUpdating('')
      return
    }

    setAlerts((current) =>
      current.map((row) => (targetIds.includes(row.id) ? { ...row, read_at: readAt } : row)),
    )
    setSelectedIds([])
    void loadAlerts()
    setBulkUpdating('')
  }, [loadAlerts, selectedIds, session?.user])

  const runBulkDismiss = useCallback(async () => {
    if (!session?.user || selectedIds.length === 0) return

    setBulkUpdating('dismiss')
    setError('')
    const targetIds = [...selectedIds]

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ is_dismissed: true })
      .eq('user_id', session.user.id)
      .in('id', targetIds)

    if (updateError) {
      captureException(updateError, {
        component: 'Alerts',
        action: 'bulk-dismiss',
      })
      setError('Could not dismiss selected alerts.')
      setBulkUpdating('')
      return
    }

    setAlerts((current) => current.filter((row) => !targetIds.includes(row.id)))
    setSelectedIds([])
    void loadAlerts()
    setBulkUpdating('')
  }, [loadAlerts, selectedIds, session?.user])

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {alerts.length}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Active alerts sorted by newest first.</p>
      </div>

      <div className="rounded-xl border border bg-card p-4 shadow-sm">
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
              className="h-10 rounded-lg border border px-3 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-xl border border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {selectedIds.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runBulkMarkRead()}
                disabled={bulkUpdating !== '' || updatingId !== ''}
                className="rounded-lg border border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="rounded-xl border border bg-card p-4 shadow-sm">
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
            <article key={index} className="rounded-xl border border bg-card p-5 shadow-sm">
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
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border bg-card p-6 text-center shadow-sm">
            <CheckCircleIcon className="h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-base font-medium text-foreground">All clear - no active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <article
              key={alert.id}
              className={`rounded-xl border p-5 shadow-sm ${
                alert.read_at ? 'border bg-card' : 'border-primary/20 bg-primary/5'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(alert.id)}
                    onChange={() => toggleSelectAlert(alert.id)}
                    className="h-4 w-4 rounded border border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Select alert ${alert.title}`}
                    disabled={bulkUpdating !== ''}
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
                <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString()}</span>
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
                  onClick={() => void markRead(alert)}
                  disabled={Boolean(alert.read_at) || updatingId === alert.id || bulkUpdating !== ''}
                  className="rounded-lg border border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {alert.read_at ? 'Read' : updatingId === alert.id ? 'Updating...' : 'Mark read'}
                </button>
                <button
                  onClick={() => void dismissAlert(alert)}
                  disabled={updatingId === alert.id || bulkUpdating !== ''}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingId === alert.id ? 'Updating...' : 'Dismiss'}
                </button>
                <button
                  onClick={() => void submitFeedback(alert, true)}
                  disabled={updatingId === alert.id || bulkUpdating !== ''}
                  className="rounded-lg border border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingId === alert.id ? 'Saving...' : 'Expected'}
                </button>
                <button
                  onClick={() => void submitFeedback(alert, false)}
                  disabled={updatingId === alert.id || bulkUpdating !== ''}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors-fast hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingId === alert.id ? 'Saving...' : 'False positive'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleReasoning(alert.id)}
                  className="rounded-lg border border px-3 py-2 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
                >
                  {expandedIds.includes(alert.id) ? 'Hide reasoning' : 'Why did this fire?'}
                </button>
              </div>

              {expandedIds.includes(alert.id) && (
                <div className="mt-4 rounded-lg border border bg-background/70 p-3">
                  <h3 className="text-sm font-semibold text-foreground">Why did this fire?</h3>
                  {alert.reasoning && Object.keys(alert.reasoning).length > 0 ? (
                    <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      {Object.entries(alert.reasoning).map(([key, value]) => (
                        <div key={`${alert.id}-${key}`} className="rounded-md border border bg-card px-2 py-1.5">
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {humanizeReasoningKey(key)}
                          </dt>
                          <dd className="mt-0.5 text-sm text-foreground">{formatReasoningValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No reasoning payload available for this alert.</p>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
