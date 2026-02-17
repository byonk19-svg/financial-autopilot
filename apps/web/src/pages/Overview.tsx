import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { captureException } from '../lib/errorReporting'
import { toNumber } from '../lib/subscriptionFormatters'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

const LAST_SYNC_RESULT_KEY = 'financial-autopilot:last-sync-result'

type AccountRow = {
  id: string
  name: string
  balance: number | string | null
  currency: string
}

export default function Overview() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + toNumber(account.balance), 0),
    [accounts],
  )

  const loadAccounts = async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('accounts')
      .select('id, name, balance, currency')
      .eq('user_id', session.user.id)
      .order('name', { ascending: true })

    if (fetchError) {
      setError('Could not load accounts.')
      setFetching(false)
      return
    }

    setAccounts((data ?? []) as AccountRow[])
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }

    void loadAccounts()
  }, [loading, navigate, session])

  const onSyncNow = async () => {
    setSyncing(true)
    setMessage('')
    setError('')

    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      const activeSession = refreshData.session ?? (await supabase.auth.getSession()).data.session

      if (!activeSession?.access_token) {
        throw new Error('Your session expired. Please log in again.')
      }

      supabase.functions.setAuth(activeSession.access_token)

      const { data: syncData, error: invokeError } = await supabase.functions.invoke('simplefin-sync', {
        body: {},
      })

      if (invokeError) {
        const unauthorized = invokeError.message.toLowerCase().includes('unauthorized')
        throw new Error(unauthorized ? 'Unauthorized. Please log in again.' : 'Sync failed.')
      }

      const payload = (syncData ?? {}) as {
        ok?: boolean
        mode?: string
        accountsSynced?: number
        transactionsSynced?: number
        warnings?: string[]
      }

      const snapshot = {
        timestamp: new Date().toISOString(),
        ok: payload.ok ?? true,
        mode: payload.mode ?? 'manual',
        accountsSynced: payload.accountsSynced ?? 0,
        transactionsSynced: payload.transactionsSynced ?? 0,
        warnings: payload.warnings ?? [],
      }
      window.localStorage.setItem(LAST_SYNC_RESULT_KEY, JSON.stringify(snapshot))

      if (typeof payload.transactionsSynced === 'number') {
        const base = `Sync complete. Accounts synced: ${payload.accountsSynced ?? 0}, transactions synced: ${payload.transactionsSynced}.`
        const warningText = payload.warnings?.length
          ? ` Warnings: ${payload.warnings.slice(0, 2).join(' | ')}`
          : ''
        setMessage(`${base}${warningText}`)
      } else {
        setMessage('Sync complete. No counts were returned.')
      }
      await loadAccounts()
    } catch (syncError) {
      captureException(syncError, {
        component: 'Overview',
        action: 'sync-now',
      })
      const text = syncError instanceof Error ? syncError.message : 'Sync failed.'
      setError(text)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track balances and run a manual sync.</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Balance</p>
            <div className="mt-2 inline-flex rounded-lg border border bg-muted/30 px-3 py-2">
              <p className="text-4xl font-bold text-foreground">
                {totalBalance.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'USD',
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onSyncNow}
            disabled={syncing || loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
        {fetching ? (
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border border bg-muted/30 px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No accounts yet. Connect your bank to start syncing balances.</p>
            <Link
              to="/connect"
              className="mt-3 inline-flex rounded-md border border px-3 py-1.5 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
            >
              Go to Connect
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-lg border border bg-muted/30 px-3 py-2 transition-colors-fast hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
                    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M7 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {account.name}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {toNumber(account.balance).toLocaleString(undefined, {
                    style: 'currency',
                    currency: account.currency || 'USD',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
