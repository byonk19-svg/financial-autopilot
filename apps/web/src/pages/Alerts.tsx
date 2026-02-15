import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type AlertRow = {
  id: string
  alert_type: 'unusual_charge' | 'duplicate_charge' | 'subscription_increase' | 'pace_warning' | 'bill_spike'
  severity: 'low' | 'medium' | 'high'
  title: string
  body: string
  merchant_normalized: string | null
  amount: number | string | null
  created_at: string
  read_at: string | null
  is_dismissed: boolean
}

function toNumber(value: number | string | null): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function severityClass(severity: AlertRow['severity']): string {
  if (severity === 'high') return 'bg-rose-100 text-rose-700'
  if (severity === 'medium') return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

export default function Alerts() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  const loadAlerts = async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('alerts')
      .select('id, alert_type, severity, title, body, merchant_normalized, amount, created_at, read_at, is_dismissed')
      .eq('user_id', session.user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Could not load alerts.')
      setFetching(false)
      return
    }

    setAlerts((data ?? []) as AlertRow[])
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    void loadAlerts()
  }, [loading, navigate, session])

  const markRead = async (alert: AlertRow) => {
    if (!session?.user || alert.read_at) return
    setUpdatingId(alert.id)
    setError('')

    const readAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('alerts')
      .update({ read_at: readAt })
      .eq('id', alert.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError('Could not mark alert as read.')
      setUpdatingId('')
      return
    }

    setAlerts((current) => current.map((row) => (row.id === alert.id ? { ...row, read_at: readAt } : row)))
    setUpdatingId('')
  }

  const dismissAlert = async (alert: AlertRow) => {
    if (!session?.user) return
    setUpdatingId(alert.id)
    setError('')

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ is_dismissed: true })
      .eq('id', alert.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError('Could not dismiss alert.')
      setUpdatingId('')
      return
    }

    setAlerts((current) => current.filter((row) => row.id !== alert.id))
    setUpdatingId('')
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Alerts</h1>
        <p className="mt-2 text-sm text-slate-600">Active alerts sorted by newest first.</p>
      </div>

      <div className="space-y-3">
        {fetching ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">No active alerts.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <article
              key={alert.id}
              className={`rounded-xl border p-5 shadow-sm ${
                alert.read_at ? 'border-slate-200 bg-white' : 'border-cyan-200 bg-cyan-50/40'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${severityClass(alert.severity)}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  {!alert.read_at && (
                    <span className="rounded-md bg-cyan-700 px-2 py-1 text-xs font-semibold text-white">Unread</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">{new Date(alert.created_at).toLocaleString()}</span>
              </div>

              <h2 className="mt-3 text-lg font-semibold text-slate-900">{alert.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{alert.body}</p>
              {alert.merchant_normalized && (
                <p className="mt-2 text-xs text-slate-500">
                  Merchant: {alert.merchant_normalized}
                  {alert.amount !== null && ` · Amount: ${toNumber(alert.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void markRead(alert)}
                  disabled={Boolean(alert.read_at) || updatingId === alert.id}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {alert.read_at ? 'Read' : updatingId === alert.id ? 'Updating...' : 'Mark read'}
                </button>
                <button
                  onClick={() => void dismissAlert(alert)}
                  disabled={updatingId === alert.id}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingId === alert.id ? 'Updating...' : 'Dismiss'}
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
