import { useCallback, useState } from 'react'
import {
  buildDashboardCreditSpendSummary,
  buildDashboardMonthlyTrendRows,
  buildDashboardRecentTransactions,
  type DashboardRecentTransactionSourceRow,
  type DashboardTrendSourceRow,
} from '@/lib/dashboardFinance'
import { captureException } from '@/lib/errorReporting'
import { toNumber } from '@/lib/subscriptionFormatters'
import { supabase } from '@/lib/supabase'
import {
  OWNER_LABELS,
  OWNER_ROW_ORDER,
  daysAgoIso,
  emptyAttentionCounts,
  emptyAutopilotMetrics,
  emptyOwnerResponsibility,
  monthStartDate,
  normalizeKpis,
  normalizeOwner,
  staleDaysFromNewestTransaction,
  todayDate,
  tomorrowDate,
} from '@/hooks/useDashboard.shared'
import type {
  AccountNewestTransactionRow,
  AccountSyncRow,
  DashboardAnomalyRow,
  DashboardCoreSnapshot,
  DashboardKpisRpc,
  DashboardOwnerAggregate,
  DashboardOwnerKey,
  DashboardOwnerResponsibilityRow,
  DashboardOwnerTxRow,
  DashboardRenewalRow,
} from '@/hooks/useDashboard.shared'

function initialCoreSnapshot(): DashboardCoreSnapshot {
  return {
    anomalies: [],
    attentionCounts: emptyAttentionCounts(),
    autopilotMetrics: emptyAutopilotMetrics(),
    creditSpendMtd: 0,
    creditTopCategories: [],
    dataFreshnessRows: [],
    errorMessage: '',
    kpis: normalizeKpis(null),
    lastAccountSyncAt: null,
    lastAnalysisAt: null,
    lastWeeklyInsightsAt: null,
    monthlyTrend: [],
    ownerResponsibility: emptyOwnerResponsibility(),
    recentTransactions: [],
    upcomingRenewals: [],
  }
}

async function fetchDashboardSnapshot(userId: string): Promise<DashboardCoreSnapshot> {
  const trendWindowStart = new Date()
  trendWindowStart.setUTCDate(1)
  trendWindowStart.setUTCMonth(trendWindowStart.getUTCMonth() - 5)
  const trendWindowStartIso = trendWindowStart.toISOString()

  const [
    kpisResult,
    renewalsResult,
    anomaliesResult,
    accountsResult,
    newestTransactionsResult,
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
    dashboardTransactionsResult,
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
    supabase.from('accounts').select('id, name, institution, last_synced_at').eq('user_id', userId),
    supabase
      .from('transactions')
      .select('account_id, posted_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .order('posted_at', { ascending: false })
      .limit(10000),
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
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .eq('is_credit', true)
      .is('category_id', null)
      .is('user_category_id', null)
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
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .eq('is_credit', true)
      .neq('type', 'transfer')
      .gte('posted_at', daysAgoIso(30)),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .eq('is_credit', true)
      .neq('type', 'transfer')
      .eq('category_source', 'rule')
      .gte('posted_at', daysAgoIso(30)),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .eq('is_credit', true)
      .neq('type', 'transfer')
      .is('category_id', null)
      .is('user_category_id', null)
      .gte('posted_at', daysAgoIso(7)),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .eq('is_credit', true)
      .neq('type', 'transfer')
      .eq('category_source', 'user')
      .gte('updated_at', daysAgoIso(7)),
    supabase
      .from('transactions')
      .select('owner, type, amount')
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .in('type', ['income', 'expense'])
      .gte('posted_at', `${monthStartDate()}T00:00:00Z`)
      .lt('posted_at', `${tomorrowDate()}T00:00:00Z`),
    supabase
      .from('transactions')
      .select(
        'id, posted_at, amount, type, category, description_short, merchant_canonical, merchant_normalized, is_credit',
      )
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_pending', false)
      .eq('is_hidden', false)
      .in('type', ['income', 'expense'])
      .gte('posted_at', trendWindowStartIso)
      .order('posted_at', { ascending: false })
      .limit(2000),
  ])

  let loadFailed = false
  let kpis = normalizeKpis(null)
  let upcomingRenewals: DashboardRenewalRow[] = []
  let anomalies: DashboardAnomalyRow[] = []
  let lastAccountSyncAt: string | null = null
  let dataFreshnessRows = initialCoreSnapshot().dataFreshnessRows
  let lastAnalysisAt: string | null = null
  let lastWeeklyInsightsAt: string | null = null
  let creditSpendMtd = initialCoreSnapshot().creditSpendMtd
  let creditTopCategories = initialCoreSnapshot().creditTopCategories
  let monthlyTrend = initialCoreSnapshot().monthlyTrend
  let ownerResponsibility = emptyOwnerResponsibility()
  let recentTransactions = initialCoreSnapshot().recentTransactions

  if (kpisResult.status === 'fulfilled' && !kpisResult.value.error) {
    kpis = normalizeKpis((kpisResult.value.data ?? null) as DashboardKpisRpc | null)
  } else {
    loadFailed = true
    captureException(kpisResult.status === 'rejected' ? kpisResult.reason : kpisResult.value.error, {
      component: 'useDashboard',
      action: 'load-dashboard-kpis',
    })
  }

  if (renewalsResult.status === 'fulfilled' && !renewalsResult.value.error) {
    upcomingRenewals = (renewalsResult.value.data ?? []) as DashboardRenewalRow[]
  } else {
    loadFailed = true
    captureException(
      renewalsResult.status === 'rejected' ? renewalsResult.reason : renewalsResult.value.error,
      {
        component: 'useDashboard',
        action: 'load-upcoming-renewals',
      },
    )
  }

  if (anomaliesResult.status === 'fulfilled' && !anomaliesResult.value.error) {
    anomalies = (anomaliesResult.value.data ?? []) as DashboardAnomalyRow[]
  } else {
    loadFailed = true
    captureException(
      anomaliesResult.status === 'rejected' ? anomaliesResult.reason : anomaliesResult.value.error,
      {
        component: 'useDashboard',
        action: 'load-anomalies',
      },
    )
  }

  let accountRows: AccountSyncRow[] = []
  if (accountsResult.status === 'fulfilled' && !accountsResult.value.error) {
    accountRows = (accountsResult.value.data ?? []) as AccountSyncRow[]
    lastAccountSyncAt =
      accountRows
        .map((row) => row.last_synced_at)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => (a > b ? -1 : 1))[0] ?? null
  } else {
    loadFailed = true
    captureException(accountsResult.status === 'rejected' ? accountsResult.reason : accountsResult.value.error, {
      component: 'useDashboard',
      action: 'load-account-sync-at',
    })
  }

  const newestByAccount = new Map<string, string>()
  if (newestTransactionsResult.status === 'fulfilled' && !newestTransactionsResult.value.error) {
    const rows = (newestTransactionsResult.value.data ?? []) as AccountNewestTransactionRow[]
    for (const row of rows) {
      if (!row.account_id || !row.posted_at) continue
      if (!newestByAccount.has(row.account_id)) newestByAccount.set(row.account_id, row.posted_at)
    }
  } else {
    loadFailed = true
    captureException(
      newestTransactionsResult.status === 'rejected'
        ? newestTransactionsResult.reason
        : newestTransactionsResult.value.error,
      {
        component: 'useDashboard',
        action: 'load-newest-transactions-by-account',
      },
    )
  }

  if (accountRows.length > 0) {
    dataFreshnessRows = accountRows
      .map((account) => {
        const newestTransactionAt = newestByAccount.get(account.id) ?? null
        const staleDays = staleDaysFromNewestTransaction(newestTransactionAt)
        const isStale = staleDays === null || staleDays > 7
        return {
          accountId: account.id,
          accountName: account.name,
          institution: account.institution,
          lastSyncedAt: account.last_synced_at,
          newestTransactionAt,
          isStale,
          staleDays,
        }
      })
      .sort((a, b) => {
        if (a.isStale !== b.isStale) return a.isStale ? -1 : 1
        const aNewest = a.newestTransactionAt ?? ''
        const bNewest = b.newestTransactionAt ?? ''
        if (aNewest === bNewest) return a.accountName.localeCompare(b.accountName)
        return aNewest > bNewest ? -1 : 1
      })
  }

  if (analysisResult.status === 'fulfilled' && !analysisResult.value.error) {
    lastAnalysisAt = analysisResult.value.data?.updated_at ?? null
  } else {
    loadFailed = true
    captureException(analysisResult.status === 'rejected' ? analysisResult.reason : analysisResult.value.error, {
      component: 'useDashboard',
      action: 'load-last-analysis-at',
    })
  }

  if (insightsResult.status === 'fulfilled' && !insightsResult.value.error) {
    lastWeeklyInsightsAt = insightsResult.value.data?.created_at ?? null
  } else {
    loadFailed = true
    captureException(insightsResult.status === 'rejected' ? insightsResult.reason : insightsResult.value.error, {
      component: 'useDashboard',
      action: 'load-last-weekly-insights-at',
    })
  }

  const attentionCounts = {
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
  }

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

  const autopilotMetrics = {
    autoCategorizedRatePct:
      totalEligibleCount30d > 0 ? (autoCategorizedCount30d / totalEligibleCount30d) * 100 : null,
    autoCategorizedCount30d,
    totalEligibleCount30d,
    uncategorizedCount7d,
    manualFixes7d,
  }

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

    const totalSpendMtd = OWNER_ROW_ORDER.reduce((sum, owner) => sum + aggregateByOwner[owner].spendMtd, 0)
    const totalIncomeMtd = OWNER_ROW_ORDER.reduce((sum, owner) => sum + aggregateByOwner[owner].incomeMtd, 0)

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

    ownerResponsibility = {
      rows,
      totalIncomeMtd,
      totalSpendMtd,
    }
  } else {
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

  if (dashboardTransactionsResult.status === 'fulfilled' && !dashboardTransactionsResult.value.error) {
    const dashboardTransactionRows = (dashboardTransactionsResult.value.data ?? []) as DashboardRecentTransactionSourceRow[]
    const creditSpendSummary = buildDashboardCreditSpendSummary(dashboardTransactionRows)
    creditSpendMtd = creditSpendSummary.total
    creditTopCategories = creditSpendSummary.topCategories
    monthlyTrend = buildDashboardMonthlyTrendRows(dashboardTransactionRows as DashboardTrendSourceRow[])
    recentTransactions = buildDashboardRecentTransactions(dashboardTransactionRows)
  } else {
    loadFailed = true
    captureException(
      dashboardTransactionsResult.status === 'rejected'
        ? dashboardTransactionsResult.reason
        : dashboardTransactionsResult.value.error,
      {
        component: 'useDashboard',
        action: 'load-dashboard-transactions',
      },
    )
  }

  return {
    anomalies,
    attentionCounts,
    autopilotMetrics,
    creditSpendMtd,
    creditTopCategories,
    dataFreshnessRows,
    errorMessage: loadFailed ? 'Some dashboard metrics could not be loaded.' : '',
    kpis,
    lastAccountSyncAt,
    lastAnalysisAt,
    lastWeeklyInsightsAt,
    monthlyTrend,
    ownerResponsibility,
    recentTransactions,
    upcomingRenewals,
  }
}

export function useDashboardData(userId: string | undefined) {
  const [snapshot, setSnapshot] = useState<DashboardCoreSnapshot>(initialCoreSnapshot())

  const loadDashboardData = useCallback(async () => {
    if (!userId) return
    const nextSnapshot = await fetchDashboardSnapshot(userId)
    setSnapshot(nextSnapshot)
  }, [userId])

  return {
    ...snapshot,
    loadDashboardData,
  }
}
