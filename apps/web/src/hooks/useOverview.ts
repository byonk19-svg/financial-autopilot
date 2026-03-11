import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { captureException } from '@/lib/errorReporting'
import { AuthExpiredError, fetchFunctionWithAuth } from '@/lib/fetchWithAuth'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { toNumber } from '@/lib/subscriptionFormatters'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import type { AccountGroup, AccountRow } from '@/lib/types'

const LAST_SYNC_RESULT_KEY = 'financial-autopilot:last-sync-result'

function isInvestment(type: string): boolean {
  return /invest|broker|retirement|401|ira|roth|wealth/i.test(type)
}

function groupAccounts(accounts: AccountRow[]): AccountGroup[] {
  const checking = accounts.filter((a) => !a.is_credit && !isInvestment(a.type))
  const credit = accounts.filter((a) => a.is_credit)
  const invest = accounts.filter((a) => !a.is_credit && isInvestment(a.type))

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

export function useOverview() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const userId = session?.user?.id

  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const groups = useMemo(() => groupAccounts(accounts), [accounts])

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

  const assignOwner = useCallback(
    async (accountId: string, owner: AccountRow['owner']): Promise<boolean> => {
      const { error: rpcError } = await supabase.rpc('assign_account_owner', {
        p_account_id: accountId,
        p_owner: owner,
      })
      if (rpcError) {
        captureException(rpcError, { component: 'Overview', action: 'assign-owner' })
        setError(`Could not update account owner: ${rpcError.message}`)
        return false
      }
      setAccounts((current) => current.map((a) => (a.id === accountId ? { ...a, owner } : a)))
      return true
    },
    [],
  )

  const onSyncNow = useCallback(async () => {
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
      const warningText = payload.warnings?.length
        ? ` Warnings: ${payload.warnings.slice(0, 2).join(' | ')}`
        : ''
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
  }, [loadAccounts, navigate])

  return {
    loading,
    accounts,
    fetching,
    syncing,
    message,
    error,
    groups,
    netWorth,
    assignOwner,
    onSyncNow,
  }
}
