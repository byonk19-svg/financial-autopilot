import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

const LAST_SYNC_RESULT_KEY = 'financial-autopilot:last-sync-result'

type AccountRow = {
  id: string
  name: string
  balance: number | string | null
  currency: string
}

function toNumber(input: number | string | null): number {
  if (typeof input === 'number') return input
  if (typeof input === 'string') {
    const parsed = Number.parseFloat(input)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
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
      const text = syncError instanceof Error ? syncError.message : 'Sync failed.'
      setError(text)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-2 text-sm text-slate-600">Track balances and run a manual sync.</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Balance</p>
            <p className="text-3xl font-bold text-slate-900">
              {totalBalance.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
              })}
            </p>
          </div>
          <button
            onClick={onSyncNow}
            disabled={syncing || loading}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Accounts</h2>
        {fetching ? (
          <p className="mt-3 text-sm text-slate-600">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No accounts yet. Run sync after connecting.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="text-sm text-slate-700">{account.name}</span>
                <span className="text-sm font-medium text-slate-900">
                  {toNumber(account.balance).toLocaleString(undefined, {
                    style: 'currency',
                    currency: account.currency || 'USD',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {message && <p className="mt-4 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    </section>
  )
}
