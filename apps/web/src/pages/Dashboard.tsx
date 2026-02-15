import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import InsightFeed from '../components/InsightFeed'
import { hasActiveSimplefinConnection } from '../lib/bankConnections'
import { functionUrl } from '../lib/functions'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type AccountBalanceRow = {
  balance: number | string | null
}

type TransactionAmountRow = {
  amount: number | string
}

type UpcomingSubscriptionRow = {
  id: string
  merchant_normalized: string
  cadence: string
  last_amount: number | string | null
  next_expected_at: string | null
  prev_amount: number | string | null
}

type HealthJobRow = {
  job_name: string
  schedule: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
}

type SystemHealthPayload = {
  ok: boolean
  generated_at: string
  latest_error: string | null
  jobs: HealthJobRow[]
}

function toNumber(input: number | string | null): number {
  if (typeof input === 'number') return input
  if (typeof input === 'string') {
    const parsed = Number.parseFloat(input)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function monthStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map((token) => Number.parseInt(token, 10))
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function formatDateTime(input: string | null): string {
  if (!input) return 'Not available'
  const date = new Date(input)
  if (Number.isNaN(date.valueOf())) return input
  return date.toLocaleString()
}

function statusTone(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded')) return 'text-emerald-700'
  if (normalized.includes('running')) return 'text-amber-700'
  if (normalized.includes('failed') || normalized.includes('error')) return 'text-rose-700'
  if (normalized.includes('missing') || normalized.includes('unavailable')) return 'text-rose-700'
  return 'text-slate-700'
}

function statusDot(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded')) return 'bg-emerald-500'
  if (normalized.includes('running')) return 'bg-amber-500'
  if (normalized.includes('failed') || normalized.includes('error')) return 'bg-rose-500'
  return 'bg-slate-300'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [checkingConnection, setCheckingConnection] = useState(true)
  const [totalBalance, setTotalBalance] = useState(0)
  const [mtdSpend, setMtdSpend] = useState(0)
  const [accountCount, setAccountCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [lastAccountSyncAt, setLastAccountSyncAt] = useState<string | null>(null)
  const [lastAnalysisAt, setLastAnalysisAt] = useState<string | null>(null)
  const [lastWeeklyInsightsAt, setLastWeeklyInsightsAt] = useState<string | null>(null)
  const [upcomingSubscriptions, setUpcomingSubscriptions] = useState<UpcomingSubscriptionRow[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealthPayload | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const stats = useMemo(
    () => [
      { label: 'Total Balance', value: totalBalance },
      { label: 'Month-To-Date Spend', value: mtdSpend },
      { label: 'Connected Accounts', value: accountCount },
      { label: 'Open Alerts', value: alertCount },
    ],
    [accountCount, alertCount, mtdSpend, totalBalance],
  )

  const getAccessToken = async (): Promise<string | null> => {
    const { data: current } = await supabase.auth.getSession()
    const currentSession = current.session

    if (currentSession?.access_token) {
      const expiresAtMs = (currentSession.expires_at ?? 0) * 1000
      const oneMinuteFromNow = Date.now() + 60_000
      if (!expiresAtMs || expiresAtMs > oneMinuteFromNow) {
        return currentSession.access_token
      }
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session?.access_token) {
      return refreshed.session.access_token
    }

    return currentSession?.access_token ?? null
  }

  const loadSidebarStats = async (userId: string) => {
    const monthStart = monthStartIso()
    const today = isoDateToday()
    const next14Days = addDaysDate(today, 14)

    const [accountsResult, transactionsResult, alertsCountResult, upcomingResult, analysisResult, insightsResult] =
      await Promise.all([
      supabase.from('accounts').select('balance, last_synced_at').eq('user_id', userId),
      supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .eq('is_pending', false)
        .gte('posted_at', monthStart),
      supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_dismissed', false),
      supabase
        .from('subscriptions')
        .select('id, merchant_normalized, cadence, last_amount, next_expected_at, prev_amount')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('classification', 'subscription')
        .gte('next_expected_at', today)
        .lte('next_expected_at', next14Days)
        .order('next_expected_at', { ascending: true }),
      supabase
        .from('user_metrics_daily')
        .select('updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('insights')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (
      accountsResult.error ||
      transactionsResult.error ||
      alertsCountResult.error ||
      upcomingResult.error ||
      analysisResult.error ||
      insightsResult.error
    ) {
      setError('Could not load dashboard stats.')
      return
    }

    const accountRows = (accountsResult.data ?? []) as Array<AccountBalanceRow & { last_synced_at: string | null }>
    const transactionRows = (transactionsResult.data ?? []) as TransactionAmountRow[]

    const nextTotalBalance = accountRows.reduce((sum, row) => sum + toNumber(row.balance), 0)
    const nextMtdSpend = transactionRows.reduce((sum, row) => {
      const amount = toNumber(row.amount)
      return amount < 0 ? sum + Math.abs(amount) : sum
    }, 0)

    setTotalBalance(nextTotalBalance)
    setMtdSpend(nextMtdSpend)
    setAccountCount(accountRows.length)
    setAlertCount(alertsCountResult.count ?? 0)
    setUpcomingSubscriptions((upcomingResult.data ?? []) as UpcomingSubscriptionRow[])
    setLastAccountSyncAt(
      accountRows
        .map((row) => row.last_synced_at)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => (a > b ? -1 : 1))[0] ?? null,
    )
    setLastAnalysisAt(analysisResult.data?.updated_at ?? null)
    setLastWeeklyInsightsAt(insightsResult.data?.created_at ?? null)
  }

  const loadSystemHealth = async () => {
    setHealthLoading(true)
    setHealthError('')

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('system-health', {
        body: {},
      })

      if (invokeError) {
        const maybeContext = invokeError as { context?: Response; message?: string }
        if (maybeContext.context) {
          const payload = (await maybeContext.context.json().catch(() => null)) as
            | { error?: string; detail?: string }
            | null
          if (payload?.detail) {
            throw new Error(payload.detail)
          }
          if (payload?.error) {
            throw new Error(payload.error)
          }
          const text = await maybeContext.context.text().catch(() => '')
          if (text) {
            throw new Error(text)
          }
        }
        throw new Error(invokeError.message ?? 'Could not load system health.')
      }

      const health = (data ?? null) as SystemHealthPayload | null
      if (!health || health.ok !== true) {
        throw new Error('Could not load system health.')
      }
      setSystemHealth(health)
    } catch (healthLoadError) {
      const detail = healthLoadError instanceof Error ? healthLoadError.message : 'Could not load system health.'
      setHealthError(detail)
    } finally {
      setHealthLoading(false)
    }
  }

  useEffect(() => {
    const ensureConnected = async () => {
      if (loading) return
      if (!session?.user) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const connected = await hasActiveSimplefinConnection(session.user.id)
        if (!connected) {
          navigate('/connect', { replace: true })
          return
        }

        await loadSidebarStats(session.user.id)
        await loadSystemHealth()
        setCheckingConnection(false)
      } catch {
        navigate('/connect', { replace: true })
      }
    }

    void ensureConnected()
  }, [loading, navigate, session])

  const onSyncNow = async () => {
    if (!session?.user) return

    setSyncing(true)
    setMessage('')
    setError('')

    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Your session expired. Please log in again.')
      }

      const response = await fetch(functionUrl('simplefin-sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        accountsSynced?: number
        transactionsSynced?: number
        warnings?: string[]
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Sync failed.')
      }

      const warnings = payload.warnings ?? []
      const warningText = warnings.length > 0 ? ` Warnings: ${warnings.slice(0, 2).join(' | ')}` : ''
      setMessage(
        `Sync complete. Accounts synced: ${payload.accountsSynced ?? 0}, transactions synced: ${
          payload.transactionsSynced ?? 0
        }.${warningText}`,
      )
      await loadSidebarStats(session.user.id)
      await loadSystemHealth()
    } catch (syncError) {
      const detail = syncError instanceof Error ? syncError.message : 'Sync failed.'
      setError(detail)
    } finally {
      setSyncing(false)
    }
  }

  if (loading || checkingConnection || !session?.user) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Financial Autopilot</h1>
        <p className="mt-2 text-sm text-slate-600">Loading your dashboard...</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Financial Autopilot</h1>
            <p className="mt-2 text-sm text-slate-600">Automation-ready dashboard and weekly insight feed.</p>
          </div>
          <button
            onClick={onSyncNow}
            disabled={syncing}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <InsightFeed userId={session.user.id} />

        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">System Health</h2>
            {healthLoading ? (
              <div className="mt-3 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Last account sync</dt>
                    <dd className="text-slate-900">{formatDateTime(lastAccountSyncAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Last analysis run</dt>
                    <dd className="text-slate-900">{formatDateTime(lastAnalysisAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Last weekly insights run</dt>
                    <dd className="text-slate-900">{formatDateTime(lastWeeklyInsightsAt)}</dd>
                  </div>
                </dl>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Error</p>
                  <p className="mt-1 text-sm text-slate-900">{systemHealth?.latest_error ?? 'None'}</p>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job Status</p>
                  {systemHealth?.jobs?.map((job) => (
                    <div key={job.job_name} className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{job.job_name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${statusDot(job.last_status)}`} />
                          <span className={`text-xs font-medium ${statusTone(job.last_status)}`}>
                            {job.last_status ?? 'unknown'}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">Schedule: {job.schedule ?? 'Not scheduled'}</p>
                      <p className="mt-1 text-xs text-slate-600">Last run: {formatDateTime(job.last_run_at)}</p>
                      {job.last_error && <p className="mt-1 text-xs text-rose-700">Error: {job.last_error}</p>}
                    </div>
                  ))}
                </div>

                {healthError && <p className="mt-3 text-sm text-rose-600">{healthError}</p>}
              </>
            )}
          </div>

          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stat.label === 'Connected Accounts' || stat.label === 'Open Alerts'
                  ? stat.value
                  : stat.value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </p>
              {stat.label === 'Open Alerts' && (
                <Link
                  to="/alerts"
                  className="mt-3 inline-flex rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                >
                  {stat.value} open
                </Link>
              )}
            </div>
          ))}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Upcoming Subscriptions (14 days)
              </h2>
              <Link
                to="/subscriptions"
                className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
              >
                View all
              </Link>
            </div>
            {upcomingSubscriptions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No upcoming charges.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingSubscriptions.slice(0, 5).map((subscription) => {
                  const lastAmount = toNumber(subscription.last_amount)
                  const prevAmount = toNumber(subscription.prev_amount)
                  const increased = prevAmount > 0 && lastAmount > prevAmount

                  return (
                    <li
                      key={subscription.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{subscription.merchant_normalized}</span>
                        <span className="text-slate-700">{subscription.next_expected_at ?? 'Unknown'}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
                        <span>
                          {subscription.cadence} ·{' '}
                          {lastAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                        </span>
                        {increased && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                            Price up
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
