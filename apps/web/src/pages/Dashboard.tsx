import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasActiveSimplefinConnection } from '../lib/bankConnections'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

const LAST_SYNC_RESULT_KEY = 'financial-autopilot:last-sync-result'

type SyncSnapshot = {
  timestamp: string
  ok: boolean
  mode: string
  accountsSynced: number
  transactionsSynced: number
  warnings: string[]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [checkingConnection, setCheckingConnection] = useState(true)
  const [lastAccountSyncAt, setLastAccountSyncAt] = useState<string | null>(null)
  const [lastSyncSnapshot, setLastSyncSnapshot] = useState<SyncSnapshot | null>(null)

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

        const { data: latestAccount } = await supabase
          .from('accounts')
          .select('last_synced_at')
          .eq('user_id', session.user.id)
          .order('last_synced_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        setLastAccountSyncAt(latestAccount?.last_synced_at ?? null)

        const rawSnapshot = window.localStorage.getItem(LAST_SYNC_RESULT_KEY)
        if (rawSnapshot) {
          try {
            const parsed = JSON.parse(rawSnapshot) as SyncSnapshot
            if (parsed?.timestamp) {
              setLastSyncSnapshot(parsed)
            }
          } catch {
            window.localStorage.removeItem(LAST_SYNC_RESULT_KEY)
          }
        }

        setCheckingConnection(false)
      } catch {
        navigate('/connect', { replace: true })
      }
    }

    void ensureConnected()
  }, [loading, navigate, session])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (loading || checkingConnection) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Loading your workspace...</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your bank connection is active. Use overview and transactions to manage data.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Sync Status</h2>
        <p className="mt-2 text-sm text-slate-700">
          Latest account sync:{' '}
          {lastAccountSyncAt ? new Date(lastAccountSyncAt).toLocaleString() : 'No sync timestamp yet'}
        </p>
        {lastSyncSnapshot ? (
          <div className="mt-2 text-sm text-slate-700">
            <p>
              Last manual sync ({new Date(lastSyncSnapshot.timestamp).toLocaleString()}): accounts{' '}
              {lastSyncSnapshot.accountsSynced}, transactions {lastSyncSnapshot.transactionsSynced}
            </p>
            {lastSyncSnapshot.warnings.length > 0 && (
              <p className="mt-1 text-amber-700">
                Warnings: {lastSyncSnapshot.warnings.slice(0, 2).join(' | ')}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No manual sync result recorded yet.</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/overview"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          Go to overview
        </Link>
        <Link
          to="/transactions"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          View transactions
        </Link>
        <button
          onClick={signOut}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </section>
  )
}
