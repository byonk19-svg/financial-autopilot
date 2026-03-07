import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { captureException } from '../lib/errorReporting'
import { AuthExpiredError, fetchFunctionWithAuth } from '../lib/fetchWithAuth'
import { getLoginRedirectPath } from '../lib/loginRedirect'
import { toNumber } from '../lib/subscriptionFormatters'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

const LAST_SYNC_RESULT_KEY = 'financial-autopilot:last-sync-result'

type AccountRow = {
  id: string
  name: string
  institution: string | null
  type: string
  is_credit: boolean
  owner: 'brianna' | 'elaine' | 'household'
  balance: number | string | null
  available_balance: number | string | null
  currency: string
}

type AccountGroup = {
  label: string
  accounts: AccountRow[]
  total: number
  isDebt: boolean
}

function toCurrency(value: number, currency = 'USD') {
  return value.toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: 2 })
}


function isInvestment(type: string): boolean {
  return /invest|broker|retirement|401|ira|roth|wealth/i.test(type)
}

type OwnerSelectProps = {
  accountId: string
  owner: AccountRow['owner']
  onSave: (accountId: string, owner: AccountRow['owner']) => Promise<boolean>
}

function OwnerSelect({ accountId, owner, onSave }: OwnerSelectProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handlePick = async (next: AccountRow['owner']) => {
    if (next === owner) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    const ok = await onSave(accountId, next)
    if (!ok) {
      // RPC failed — nothing to revert in local state since we optimistically
      // wait for the server before updating. The error is shown in the page.
    }
    setSaving(false)
  }

  const triggerClass =
    owner === 'brianna' ? 'bg-primary/10 text-primary' :
    owner === 'elaine'  ? 'bg-violet-100 text-violet-700' :
    'bg-muted/60 text-muted-foreground border border-dashed border-border'

  const triggerLabel =
    owner === 'brianna' ? 'Brianna' :
    owner === 'elaine'  ? 'Elaine' :
    saving              ? '…' : '+ Assign'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${triggerClass}`}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[110px] overflow-hidden rounded-lg border border-border bg-card shadow-md">
          {(['brianna', 'elaine', 'household'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { void handlePick(opt) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60 ${opt === owner ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
            >
              <span className={`h-2 w-2 rounded-full ${opt === 'brianna' ? 'bg-primary' : opt === 'elaine' ? 'bg-violet-500' : 'bg-muted-foreground/40'}`} />
              {opt === 'brianna' ? 'Brianna' : opt === 'elaine' ? 'Elaine' : 'Household'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function groupAccounts(accounts: AccountRow[]): AccountGroup[] {
  const checking = accounts.filter((a) => !a.is_credit && !isInvestment(a.type))
  const credit   = accounts.filter((a) => a.is_credit)
  const invest   = accounts.filter((a) => !a.is_credit && isInvestment(a.type))

  const groups: AccountGroup[] = []

  if (checking.length > 0) {
    groups.push({
      label: 'Checking & Savings',
      accounts: checking,
      total: checking.reduce((sum, a) => sum + toNumber(a.balance), 0),
      isDebt: false,
    })
  }
  if (credit.length > 0) {
    groups.push({
      label: 'Credit Cards',
      accounts: credit,
      total: credit.reduce((sum, a) => sum + toNumber(a.balance), 0),
      isDebt: true,
    })
  }
  if (invest.length > 0) {
    groups.push({
      label: 'Investments',
      accounts: invest,
      total: invest.reduce((sum, a) => sum + toNumber(a.balance), 0),
      isDebt: false,
    })
  }

  return groups
}

function CardIcon({ isCredit, isInvest }: { isCredit: boolean; isInvest: boolean }) {
  if (isCredit) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17" cy="14" r="1.5" fill="currentColor" />
      </svg>
    )
  }
  if (isInvest) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
        <polyline points="3 17 9 11 13 15 21 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="17 7 21 7 21 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const userId = session?.user?.id

  const groups = useMemo(() => groupAccounts(accounts), [accounts])

  // Net worth = checking + investments + credit card balances
  // Credit card balances from SimpleFIN are typically negative (debt owed),
  // so summing all accounts gives a true net worth figure.
  const netWorth = useMemo(
    () => accounts.reduce((sum, a) => sum + toNumber(a.balance), 0),
    [accounts],
  )

  const loadAccounts = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('accounts')
      .select('id, name, institution, type, is_credit, owner, balance, available_balance, currency')
      .eq('user_id', userId)
      .order('institution', { ascending: true })
      .order('name', { ascending: true })

    if (fetchError) {
      setError('Could not load accounts.')
      setFetching(false)
      return
    }

    setAccounts((data ?? []) as AccountRow[])
    setFetching(false)
  }, [userId])

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate(getLoginRedirectPath(), { replace: true })
      return
    }
    void loadAccounts()
  }, [loading, loadAccounts, navigate, session?.user])

  const assignOwner = async (accountId: string, owner: AccountRow['owner']): Promise<boolean> => {
    const { error: rpcError } = await supabase.rpc('assign_account_owner', {
      p_account_id: accountId,
      p_owner: owner,
    })
    if (rpcError) {
      captureException(rpcError, { component: 'Overview', action: 'assign-owner' })
      setError(`Could not update account owner: ${rpcError.message}`)
      return false
    }
    setAccounts((current) =>
      current.map((a) => (a.id === accountId ? { ...a, owner } : a)),
    )
    return true
  }

  const onSyncNow = async () => {
    setSyncing(true)
    setMessage('')
    setError('')

    try {
      const response = await fetchFunctionWithAuth('simplefin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        ok?: boolean
        mode?: string
        accountsSynced?: number
        transactionsSynced?: number
        warnings?: string[]
      }
      if (!response.ok) throw new Error(payload.error ?? 'Sync failed.')

      const snapshot = {
        timestamp: new Date().toISOString(),
        ok: payload.ok ?? true,
        mode: payload.mode ?? 'manual',
        accountsSynced: payload.accountsSynced ?? 0,
        transactionsSynced: payload.transactionsSynced ?? 0,
        warnings: payload.warnings ?? [],
      }
      window.localStorage.setItem(LAST_SYNC_RESULT_KEY, JSON.stringify(snapshot))

      const base = `Sync complete. Accounts: ${payload.accountsSynced ?? 0}, transactions: ${payload.transactionsSynced ?? 0}.`
      const warningText = payload.warnings?.length ? ` Warnings: ${payload.warnings.slice(0, 2).join(' | ')}` : ''
      setMessage(`${base}${warningText}`)
      await loadAccounts()
    } catch (syncError) {
      if (syncError instanceof AuthExpiredError) {
        navigate(getLoginRedirectPath(), { replace: true })
      }
      captureException(syncError, { component: 'Overview', action: 'sync-now' })
      setError(syncError instanceof Error ? syncError.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Account balances across all linked accounts. Assign each account to Brianna, Elaine, or Household.</p>
          </div>
          <button
            onClick={onSyncNow}
            disabled={syncing || loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>

        {/* Net worth summary */}
        {!fetching && accounts.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.label} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <p className={`mt-1 text-xl font-semibold ${group.isDebt && toNumber(group.total) < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                  {toCurrency(toNumber(group.total))}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-primary/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net worth</p>
              <p className={`mt-1 text-xl font-semibold ${netWorth < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {toCurrency(netWorth)}
              </p>
            </div>
          </div>
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

      {/* Account groups */}
      {fetching ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="rounded-lg border border-dashed border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No accounts yet. Connect your bank to start syncing balances.</p>
            <Link
              to="/connect"
              className="mt-3 inline-flex rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
            >
              Go to Connect
            </Link>
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
              <span className={`text-sm font-semibold ${group.isDebt && toNumber(group.total) < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                {toCurrency(toNumber(group.total))}
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {group.accounts.map((account) => {
                const bal = toNumber(account.balance)
                const available = account.available_balance !== null && account.available_balance !== undefined
                  ? toNumber(account.available_balance)
                  : null

                return (
                  <li
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors-fast hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-foreground">
                      <CardIcon isCredit={account.is_credit} isInvest={isInvestment(account.type)} />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium leading-tight">{account.name}</span>
                        {account.institution && (
                          <span className="text-xs text-muted-foreground">{account.institution}</span>
                        )}
                      </span>
                      <OwnerSelect
                        accountId={account.id}
                        owner={account.owner}
                        onSave={assignOwner}
                      />
                    </span>

                    <span className="flex flex-col items-end gap-0.5">
                      <span className={`text-sm font-semibold ${group.isDebt && bal < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                        {toCurrency(bal, account.currency || 'USD')}
                      </span>
                      {available !== null && group.isDebt && (
                        <span className="text-[11px] text-muted-foreground">
                          {toCurrency(available, account.currency || 'USD')} avail
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
