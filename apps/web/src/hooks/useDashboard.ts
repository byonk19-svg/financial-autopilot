import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasActiveSimplefinConnection } from '@/lib/bankConnections'
import { captureException } from '@/lib/errorReporting'
import { AuthExpiredError, fetchFunctionWithAuth } from '@/lib/fetchWithAuth'
import { toNumber } from '@/lib/subscriptionFormatters'
import { supabase } from '@/lib/supabase'
import type { SavingsBucketSummaryRpc, ShiftWeekSummaryRpc } from '@/lib/types'

type DashboardKpisRpc = {
  income_mtd: number | string | null
  income_brianna: number | string | null
  income_elaine: number | string | null
  spend_mtd: number | string | null
  cash_flow_mtd: number | string | null
  spend_last_month: number | string | null
  spend_delta: number | string | null
  spend_delta_pct: number | string | null
  top_categories: Array<{
    category: string
    amount: number | string
  }>
}

export type DashboardTopCategory = {
  category: string
  amount: number
}

export type DashboardRenewalRow = {
  subscription_id: string
  merchant_normalized: string
  cadence: string
  next_expected_at: string | null
  last_amount: number | string | null
  monthly_equivalent: number | string | null
  days_until: number | null
}

export type DashboardAnomalyRow = {
  transaction_id: string
  posted_at: string
  merchant_canonical: string
  amount: number | string
  baseline_avg: number | string | null
  baseline_stddev: number | string | null
  score: number | string | null
  reason: string | null
}

type AccountSyncRow = {
  last_synced_at: string | null
}

export type HealthJobRow = {
  job_name: string
  schedule: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
}

export type SystemHealthPayload = {
  ok: boolean
  generated_at: string
  latest_error: string | null
  jobs: HealthJobRow[]
}

export type DashboardAttentionCounts = {
  uncategorizedTransactions: number
  reviewSubscriptions: number
  unreadAlerts: number
  unownedAccounts: number
}

export type DashboardKpis = {
  incomeMtd: number
  incomeBrianna: number
  incomeElaine: number
  spendMtd: number
  cashFlowMtd: number
  spendLastMonth: number
  spendDelta: number
  spendDeltaPct: number | null
  topCategories: DashboardTopCategory[]
}

export type DashboardAutopilotMetrics = {
  autoCategorizedRatePct: number | null
  autoCategorizedCount30d: number
  totalEligibleCount30d: number
  uncategorizedCount7d: number
  manualFixes7d: number
}

type DashboardOwnerKey = 'brianna' | 'elaine' | 'household' | 'unknown'

const OWNER_ROW_ORDER: DashboardOwnerKey[] = ['brianna', 'elaine', 'household', 'unknown']
const OWNER_LABELS: Record<DashboardOwnerKey, string> = {
  brianna: 'Brianna',
  elaine: 'Elaine',
  household: 'Household',
  unknown: 'Unknown',
}

type DashboardOwnerAggregate = {
  incomeMtd: number
  spendMtd: number
}

type DashboardOwnerTxRow = {
  owner: string | null
  type: string | null
  amount: number | string | null
}

export type DashboardOwnerResponsibilityRow = {
  owner: DashboardOwnerKey
  label: string
  incomeMtd: number
  spendMtd: number
  cashFlowMtd: number
  spendSharePct: number | null
}

export type DashboardOwnerResponsibility = {
  rows: DashboardOwnerResponsibilityRow[]
  totalIncomeMtd: number
  totalSpendMtd: number
}

function normalizeOwner(owner: string | null): DashboardOwnerKey {
  if (owner === 'brianna' || owner === 'elaine' || owner === 'household') return owner
  return 'unknown'
}

function emptyOwnerResponsibility(): DashboardOwnerResponsibility {
  return {
    rows: OWNER_ROW_ORDER.filter((owner) => owner !== 'unknown').map((owner) => ({
      owner,
      label: OWNER_LABELS[owner],
      incomeMtd: 0,
      spendMtd: 0,
      cashFlowMtd: 0,
      spendSharePct: null,
    })),
    totalIncomeMtd: 0,
    totalSpendMtd: 0,
  }
}

function monthStartDate(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10)
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowDate(): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function daysAgoIso(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

export function formatDateTime(input: string | null): string {
  if (!input) return 'Not available'
  const date = new Date(input)
  if (Number.isNaN(date.valueOf())) return input
  return date.toLocaleString()
}

export function statusTone(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded')) return 'text-emerald-700'
  if (normalized.includes('running')) return 'text-amber-700'
  if (normalized.includes('failed') || normalized.includes('error')) return 'text-rose-700'
  if (normalized.includes('missing') || normalized.includes('unavailable')) return 'text-rose-700'
  return 'text-muted-foreground'
}

export function statusDot(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded')) return 'bg-emerald-500'
  if (normalized.includes('running')) return 'bg-amber-500'
  if (normalized.includes('failed') || normalized.includes('error')) return 'bg-rose-500'
  return 'bg-muted-foreground/40'
}

function normalizeKpis(data: DashboardKpisRpc | null): DashboardKpis {
  const topCategoriesRaw = Array.isArray(data?.top_categories) ? data.top_categories : []
  const topCategories: DashboardTopCategory[] = topCategoriesRaw.map((row) => ({
    category: row.category || 'Uncategorized',
    amount: toNumber(row.amount),
  }))

  return {
    incomeMtd: toNumber(data?.income_mtd ?? 0),
    incomeBrianna: toNumber(data?.income_brianna ?? 0),
    incomeElaine: toNumber(data?.income_elaine ?? 0),
    spendMtd: toNumber(data?.spend_mtd ?? 0),
    cashFlowMtd: toNumber(data?.cash_flow_mtd ?? 0),
    spendLastMonth: toNumber(data?.spend_last_month ?? 0),
    spendDelta: toNumber(data?.spend_delta ?? 0),
    spendDeltaPct: data?.spend_delta_pct === null || data?.spend_delta_pct === undefined
      ? null
      : toNumber(data.spend_delta_pct),
    topCategories,
  }
}

export function useDashboard(userId: string | undefined) {
  const [checkingConnection, setCheckingConnection] = useState(true)
  const [needsConnection, setNeedsConnection] = useState(false)
  const [kpis, setKpis] = useState<DashboardKpis>(normalizeKpis(null))
  const [upcomingRenewals, setUpcomingRenewals] = useState<DashboardRenewalRow[]>([])
  const [anomalies, setAnomalies] = useState<DashboardAnomalyRow[]>([])
  const [lastAccountSyncAt, setLastAccountSyncAt] = useState<string | null>(null)
  const [lastAnalysisAt, setLastAnalysisAt] = useState<string | null>(null)
  const [lastWeeklyInsightsAt, setLastWeeklyInsightsAt] = useState<string | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealthPayload | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState('')
  const [attentionCounts, setAttentionCounts] = useState<DashboardAttentionCounts>({
    uncategorizedTransactions: 0,
    reviewSubscriptions: 0,
    unreadAlerts: 0,
    unownedAccounts: 0,
  })
  const [autopilotMetrics, setAutopilotMetrics] = useState<DashboardAutopilotMetrics>({
    autoCategorizedRatePct: null,
    autoCategorizedCount30d: 0,
    totalEligibleCount30d: 0,
    uncategorizedCount7d: 0,
    manualFixes7d: 0,
  })
  const [ownerResponsibility, setOwnerResponsibility] = useState<DashboardOwnerResponsibility>(
    emptyOwnerResponsibility(),
  )
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [syncNeedsReconnect, setSyncNeedsReconnect] = useState(false)

  // supplemental: shift week + savings buckets (non-critical, loaded in parallel)
  const [shiftSummary, setShiftSummary] = useState<ShiftWeekSummaryRpc | null>(null)
  const [savingsSummary, setSavingsSummary] = useState<SavingsBucketSummaryRpc | null>(null)
  const [shiftLoading, setShiftLoading] = useState(true)
  const [savingsLoading, setSavingsLoading] = useState(true)

  const loadDashboardData = useCallback(async () => {
    if (!userId) return

    const [
      kpisResult,
      renewalsResult,
      anomaliesResult,
      accountsResult,
      analysisResult,
      insightsResult,
      uncategorizedResult,
      reviewSubsResult,
      unreadAlertsResult,
      unownedAccountsResult,
      totalEligibleAutoRateResult,
      autoCategorizedResult,
      uncategorizedLast7dResult,
      manualFixesLast7dResult,
      ownerTransactionsMtdResult,
    ] = await Promise.allSettled([
      supabase.rpc('dashboard_kpis', {
        start_date: monthStartDate(),
        end_date: todayDate(),
      }),
      supabase.rpc('upcoming_renewals', {
        lookahead_days: 14,
      }),
      supabase.rpc('anomalies', {
        max_rows: 5,
      }),
      supabase.from('accounts').select('last_synced_at').eq('user_id', userId),
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
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_credit', true)
        .is('category_id', null)
        .neq('type', 'transfer'),
      supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('classification', 'needs_review'),
      supabase
        .from('autopilot_alerts')
        .select('*', { count: 'exact', head: true })
        .is('dismissed_at', null),
      supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .is('owner', null),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_credit', true)
        .neq('type', 'transfer')
        .gte('posted_at', daysAgoIso(30)),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_credit', true)
        .neq('type', 'transfer')
        .eq('category_source', 'rule')
        .gte('posted_at', daysAgoIso(30)),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_credit', true)
        .neq('type', 'transfer')
        .is('category_id', null)
        .is('user_category_id', null)
        .gte('posted_at', daysAgoIso(7)),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_credit', true)
        .neq('type', 'transfer')
        .eq('category_source', 'user')
        .gte('updated_at', daysAgoIso(7)),
      supabase
        .from('transactions')
        .select('owner, type, amount')
        .eq('is_deleted', false)
        .eq('is_pending', false)
        .in('type', ['income', 'expense'])
        .gte('posted_at', `${monthStartDate()}T00:00:00Z`)
        .lt('posted_at', `${tomorrowDate()}T00:00:00Z`),
    ])

    let loadFailed = false

    if (kpisResult.status === 'fulfilled' && !kpisResult.value.error) {
      setKpis(normalizeKpis((kpisResult.value.data ?? null) as DashboardKpisRpc | null))
    } else {
      loadFailed = true
      captureException(kpisResult.status === 'rejected' ? kpisResult.reason : kpisResult.value.error, {
        component: 'useDashboard',
        action: 'load-dashboard-kpis',
      })
    }

    if (renewalsResult.status === 'fulfilled' && !renewalsResult.value.error) {
      setUpcomingRenewals((renewalsResult.value.data ?? []) as DashboardRenewalRow[])
    } else {
      loadFailed = true
      captureException(renewalsResult.status === 'rejected' ? renewalsResult.reason : renewalsResult.value.error, {
        component: 'useDashboard',
        action: 'load-upcoming-renewals',
      })
    }

    if (anomaliesResult.status === 'fulfilled' && !anomaliesResult.value.error) {
      setAnomalies((anomaliesResult.value.data ?? []) as DashboardAnomalyRow[])
    } else {
      loadFailed = true
      captureException(anomaliesResult.status === 'rejected' ? anomaliesResult.reason : anomaliesResult.value.error, {
        component: 'useDashboard',
        action: 'load-anomalies',
      })
    }

    if (accountsResult.status === 'fulfilled' && !accountsResult.value.error) {
      const accountRows = (accountsResult.value.data ?? []) as AccountSyncRow[]
      setLastAccountSyncAt(
        accountRows
          .map((row) => row.last_synced_at)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => (a > b ? -1 : 1))[0] ?? null,
      )
    } else {
      loadFailed = true
      captureException(accountsResult.status === 'rejected' ? accountsResult.reason : accountsResult.value.error, {
        component: 'useDashboard',
        action: 'load-account-sync-at',
      })
    }

    if (analysisResult.status === 'fulfilled' && !analysisResult.value.error) {
      setLastAnalysisAt(analysisResult.value.data?.updated_at ?? null)
    } else {
      loadFailed = true
      captureException(analysisResult.status === 'rejected' ? analysisResult.reason : analysisResult.value.error, {
        component: 'useDashboard',
        action: 'load-last-analysis-at',
      })
    }

    if (insightsResult.status === 'fulfilled' && !insightsResult.value.error) {
      setLastWeeklyInsightsAt(insightsResult.value.data?.created_at ?? null)
    } else {
      loadFailed = true
      captureException(insightsResult.status === 'rejected' ? insightsResult.reason : insightsResult.value.error, {
        component: 'useDashboard',
        action: 'load-last-weekly-insights-at',
      })
    }

    setAttentionCounts({
      uncategorizedTransactions:
        uncategorizedResult.status === 'fulfilled' && !uncategorizedResult.value.error
          ? (uncategorizedResult.value.count ?? 0)
          : 0,
      reviewSubscriptions:
        reviewSubsResult.status === 'fulfilled' && !reviewSubsResult.value.error
          ? (reviewSubsResult.value.count ?? 0)
          : 0,
      unreadAlerts:
        unreadAlertsResult.status === 'fulfilled' && !unreadAlertsResult.value.error
          ? (unreadAlertsResult.value.count ?? 0)
          : 0,
      unownedAccounts:
        unownedAccountsResult.status === 'fulfilled' && !unownedAccountsResult.value.error
          ? (unownedAccountsResult.value.count ?? 0)
          : 0,
    })

    const totalEligibleCount30d =
      totalEligibleAutoRateResult.status === 'fulfilled' && !totalEligibleAutoRateResult.value.error
        ? (totalEligibleAutoRateResult.value.count ?? 0)
        : 0

    const autoCategorizedCount30d =
      autoCategorizedResult.status === 'fulfilled' && !autoCategorizedResult.value.error
        ? (autoCategorizedResult.value.count ?? 0)
        : 0

    const uncategorizedCount7d =
      uncategorizedLast7dResult.status === 'fulfilled' && !uncategorizedLast7dResult.value.error
        ? (uncategorizedLast7dResult.value.count ?? 0)
        : 0

    const manualFixes7d =
      manualFixesLast7dResult.status === 'fulfilled' && !manualFixesLast7dResult.value.error
        ? (manualFixesLast7dResult.value.count ?? 0)
        : 0

    setAutopilotMetrics({
      autoCategorizedRatePct:
        totalEligibleCount30d > 0 ? (autoCategorizedCount30d / totalEligibleCount30d) * 100 : null,
      autoCategorizedCount30d,
      totalEligibleCount30d,
      uncategorizedCount7d,
      manualFixes7d,
    })

    if (ownerTransactionsMtdResult.status === 'fulfilled' && !ownerTransactionsMtdResult.value.error) {
      const ownerRows = (ownerTransactionsMtdResult.value.data ?? []) as DashboardOwnerTxRow[]
      const aggregateByOwner = OWNER_ROW_ORDER.reduce<Record<DashboardOwnerKey, DashboardOwnerAggregate>>(
        (acc, owner) => ({
          ...acc,
          [owner]: { incomeMtd: 0, spendMtd: 0 },
        }),
        {} as Record<DashboardOwnerKey, DashboardOwnerAggregate>,
      )

      for (const row of ownerRows) {
        const owner = normalizeOwner(row.owner)
        const amount = toNumber(row.amount)
        if (row.type === 'income') {
          aggregateByOwner[owner].incomeMtd += amount
        } else if (row.type === 'expense') {
          aggregateByOwner[owner].spendMtd += Math.abs(amount)
        }
      }

      const totalSpendMtd = OWNER_ROW_ORDER.reduce(
        (sum, owner) => sum + aggregateByOwner[owner].spendMtd,
        0,
      )
      const totalIncomeMtd = OWNER_ROW_ORDER.reduce(
        (sum, owner) => sum + aggregateByOwner[owner].incomeMtd,
        0,
      )

      const rows = OWNER_ROW_ORDER
        .map((owner): DashboardOwnerResponsibilityRow => {
          const spendMtd = aggregateByOwner[owner].spendMtd
          const incomeMtd = aggregateByOwner[owner].incomeMtd
          return {
            owner,
            label: OWNER_LABELS[owner],
            spendMtd,
            incomeMtd,
            cashFlowMtd: incomeMtd - spendMtd,
            spendSharePct: totalSpendMtd > 0 ? (spendMtd / totalSpendMtd) * 100 : null,
          }
        })
        .filter((row) => row.owner !== 'unknown' || row.spendMtd > 0 || row.incomeMtd > 0)

      setOwnerResponsibility({
        rows,
        totalIncomeMtd,
        totalSpendMtd,
      })
    } else {
      setOwnerResponsibility(emptyOwnerResponsibility())
      if (ownerTransactionsMtdResult.status === 'fulfilled' && ownerTransactionsMtdResult.value.error) {
        captureException(ownerTransactionsMtdResult.value.error, {
          component: 'useDashboard',
          action: 'load-owner-responsibility',
        })
      }
      if (ownerTransactionsMtdResult.status === 'rejected') {
        captureException(ownerTransactionsMtdResult.reason, {
          component: 'useDashboard',
          action: 'load-owner-responsibility',
        })
      }
    }

    if (loadFailed) {
      setError('Some dashboard metrics could not be loaded.')
      return
    }

    setError('')
  }, [userId])

  const loadSystemHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError('')

    try {
      const response = await fetchFunctionWithAuth('system-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string; ok?: boolean }
        | SystemHealthPayload
        | null
      if (!response.ok) {
        throw new Error(
          (payload && typeof payload === 'object' && ('detail' in payload || 'error' in payload))
            ? (payload.detail ?? payload.error ?? 'Could not load system health.')
            : 'Could not load system health.',
        )
      }

      const health = (payload ?? null) as SystemHealthPayload | null
      if (!health || health.ok !== true) {
        throw new Error('Could not load system health.')
      }
      setSystemHealth(health)
    } catch (healthLoadError) {
      if (healthLoadError instanceof AuthExpiredError) {
        setSessionExpired(true)
      }
      captureException(healthLoadError, {
        component: 'useDashboard',
        action: 'load-system-health',
      })
      const detail = healthLoadError instanceof Error ? healthLoadError.message : 'Could not load system health.'
      setHealthError(detail)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await loadDashboardData()
    await loadSystemHealth()
  }, [loadDashboardData, loadSystemHealth])

  useEffect(() => {
    const ensureConnected = async () => {
      if (!userId) {
        setCheckingConnection(false)
        return
      }

      try {
        const connected = await hasActiveSimplefinConnection(userId)
        if (!connected) {
          setNeedsConnection(true)
          setCheckingConnection(false)
          return
        }

        await refreshAll()
        setNeedsConnection(false)
        setCheckingConnection(false)
      } catch (connectionError) {
        captureException(connectionError, {
          component: 'useDashboard',
          action: 'ensure-connected',
        })
        setNeedsConnection(true)
        setCheckingConnection(false)
      }
    }

    void ensureConnected()
  }, [refreshAll, userId])

  useEffect(() => {
    if (!userId) return

    let active = true

    const loadSupplemental = async () => {
      setShiftLoading(true)
      setSavingsLoading(true)

      try {
        const [shiftResult, savingsResult] = await Promise.all([
          supabase.rpc('shift_week_summary'),
          supabase.rpc('savings_bucket_summary'),
        ])

        if (!active) return

        if (shiftResult.error) throw shiftResult.error
        if (savingsResult.error) throw savingsResult.error

        setShiftSummary((shiftResult.data ?? null) as ShiftWeekSummaryRpc | null)
        setSavingsSummary((savingsResult.data ?? null) as SavingsBucketSummaryRpc | null)
      } catch (supplementalError) {
        if (!active) return
        setShiftSummary(null)
        setSavingsSummary(null)
        captureException(supplementalError, {
          component: 'useDashboard',
          action: 'load-shift-and-savings-rpcs',
        })
      } finally {
        if (active) {
          setShiftLoading(false)
          setSavingsLoading(false)
        }
      }
    }

    void loadSupplemental()

    return () => {
      active = false
    }
  }, [userId])

  const onSyncNow = useCallback(async () => {
    if (!userId) return

    setSyncing(true)
    setMessage('')
    setError('')
    setSessionExpired(false)
    setSyncNeedsReconnect(false)

    try {
      const response = await fetchFunctionWithAuth('simplefin-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const hasConnectionWarning = warnings.some((warning) => /decrypt|token|unauthorized/i.test(warning))
      if (hasConnectionWarning) {
        setMessage('')
        setError('Sync could not read your bank connection. Please reconnect SimpleFIN from the Connect page.')
        setSyncNeedsReconnect(true)
        setNeedsConnection(true)
        return
      }
      const warningText = warnings.length > 0 ? ` Warnings: ${warnings.slice(0, 2).join(' | ')}` : ''
      setMessage(
        `Sync complete. Accounts synced: ${payload.accountsSynced ?? 0}, transactions synced: ${
          payload.transactionsSynced ?? 0
        }.${warningText}`,
      )
      setSyncNeedsReconnect(false)
      await refreshAll()
    } catch (syncError) {
      if (syncError instanceof AuthExpiredError) {
        setSessionExpired(true)
      }
      captureException(syncError, {
        component: 'useDashboard',
        action: 'sync-now',
      })
      const detail = syncError instanceof Error ? syncError.message : 'Sync failed.'
      setError(detail)
      if (/decrypt|token|unauthorized|reconnect/i.test(detail)) {
        setSyncNeedsReconnect(true)
      }
    } finally {
      setSyncing(false)
    }
  }, [refreshAll, userId])

  const renewalMonthlyTotal = useMemo(
    () => upcomingRenewals.reduce((sum, row) => sum + toNumber(row.monthly_equivalent), 0),
    [upcomingRenewals],
  )

  return {
    checkingConnection,
    needsConnection,
    attentionCounts,
    autopilotMetrics,
    ownerResponsibility,
    kpis,
    upcomingRenewals,
    anomalies,
    renewalMonthlyTotal,
    lastAccountSyncAt,
    lastAnalysisAt,
    lastWeeklyInsightsAt,
    systemHealth,
    healthLoading,
    healthError,
    syncing,
    message,
    error,
    sessionExpired,
    syncNeedsReconnect,
    onSyncNow,
    shiftSummary,
    savingsSummary,
    shiftLoading,
    savingsLoading,
  }
}
