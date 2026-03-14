import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasActiveSimplefinConnection } from '@/lib/bankConnections'
import { captureException } from '@/lib/errorReporting'
import { toNumber } from '@/lib/subscriptionFormatters'
import { useDashboardData } from '@/hooks/useDashboard.data'
import { useDashboardHealth } from '@/hooks/useDashboard.health'
import {
  formatDateTime,
  statusDot,
  statusTone,
} from '@/hooks/useDashboard.shared'
import type {
  DashboardAttentionCounts,
  DashboardDataFreshnessRow,
  DashboardOwnerResponsibility,
  DashboardOwnerResponsibilityRow,
  DashboardAnomalyRow,
  DashboardAutopilotMetrics,
  DashboardKpis,
  DashboardRenewalRow,
  SystemHealthPayload,
} from '@/hooks/useDashboard.shared'
import { useDashboardSupplemental } from '@/hooks/useDashboard.supplemental'
import { useDashboardSync } from '@/hooks/useDashboard.sync'
import type {
  DashboardMonthlyTrendRow,
  DashboardRecentTransaction,
  DashboardTopSpendCategory,
} from '@/lib/dashboardFinance'

export type {
  DashboardAnomalyRow,
  DashboardAttentionCounts,
  DashboardAutopilotMetrics,
  DashboardDataFreshnessRow,
  DashboardKpis,
  DashboardMonthlyTrendRow,
  DashboardOwnerResponsibility,
  DashboardOwnerResponsibilityRow,
  DashboardRecentTransaction,
  DashboardTopSpendCategory,
  DashboardRenewalRow,
  SystemHealthPayload,
}

export { formatDateTime, statusDot, statusTone }

type UseDashboardOptions = {
  loadHealth?: boolean
  loadSupplemental?: boolean
}

export function useDashboard(userId: string | undefined, options: UseDashboardOptions = {}) {
  const { loadHealth = true, loadSupplemental = true } = options
  const [checkingConnection, setCheckingConnection] = useState(true)
  const [needsConnection, setNeedsConnection] = useState(false)

  const {
    anomalies,
    attentionCounts,
    autopilotMetrics,
    creditSpendMtd,
    creditTopCategories,
    dataFreshnessRows,
    error: dataError,
    kpis,
    lastAccountSyncAt,
    lastAnalysisAt,
    lastWeeklyInsightsAt,
    loadDashboardData,
    monthlyTrend,
    ownerResponsibility,
    recentTransactions,
    upcomingRenewals,
  } = normalizeDashboardDataHook(useDashboardData(userId))

  const {
    systemHealth,
    healthLoading,
    healthError,
    healthSessionExpired,
    loadSystemHealth,
  } = useDashboardHealth()

  const {
    shiftSummary,
    savingsSummary,
    shiftLoading,
    savingsLoading,
  } = useDashboardSupplemental(userId, loadSupplemental)

  const refreshAll = useCallback(async () => {
    await loadDashboardData()
    if (loadHealth) {
      await loadSystemHealth()
    }
  }, [loadDashboardData, loadHealth, loadSystemHealth])

  const {
    syncing,
    message,
    error: syncError,
    syncSessionExpired,
    syncNeedsReconnect,
    onSyncNow,
    onRepairLast6Months,
  } = useDashboardSync({
    onNeedsConnection: () => {
      setNeedsConnection(true)
    },
    onRefreshRequested: refreshAll,
    userId,
  })

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
    if (!loadHealth || checkingConnection || !userId || systemHealth || healthLoading) return
    void loadSystemHealth()
  }, [checkingConnection, healthLoading, loadHealth, loadSystemHealth, systemHealth, userId])

  const renewalMonthlyTotal = useMemo(
    () => upcomingRenewals.reduce((sum, row) => sum + toNumber(row.monthly_equivalent), 0),
    [upcomingRenewals],
  )

  return {
    checkingConnection,
    needsConnection,
    attentionCounts,
    autopilotMetrics,
    creditSpendMtd,
    creditTopCategories,
    ownerResponsibility,
    kpis,
    upcomingRenewals,
    anomalies,
    renewalMonthlyTotal,
    lastAccountSyncAt,
    lastAnalysisAt,
    lastWeeklyInsightsAt,
    dataFreshnessRows,
    monthlyTrend,
    recentTransactions,
    systemHealth,
    healthLoading,
    healthError,
    syncing,
    message,
    error: syncError || dataError,
    sessionExpired: healthSessionExpired || syncSessionExpired,
    syncNeedsReconnect,
    onSyncNow,
    onRepairLast6Months,
    shiftSummary,
    savingsSummary,
    shiftLoading,
    savingsLoading,
  }
}

function normalizeDashboardDataHook(data: ReturnType<typeof useDashboardData>): {
  anomalies: DashboardAnomalyRow[]
  attentionCounts: DashboardAttentionCounts
  autopilotMetrics: DashboardAutopilotMetrics
  creditSpendMtd: number
  creditTopCategories: DashboardTopSpendCategory[]
  dataFreshnessRows: DashboardDataFreshnessRow[]
  error: string
  kpis: DashboardKpis
  lastAccountSyncAt: string | null
  lastAnalysisAt: string | null
  lastWeeklyInsightsAt: string | null
  loadDashboardData: () => Promise<void>
  monthlyTrend: DashboardMonthlyTrendRow[]
  ownerResponsibility: DashboardOwnerResponsibility
  recentTransactions: DashboardRecentTransaction[]
  upcomingRenewals: DashboardRenewalRow[]
} {
  return {
    anomalies: data.anomalies,
    attentionCounts: data.attentionCounts,
    autopilotMetrics: data.autopilotMetrics,
    creditSpendMtd: data.creditSpendMtd,
    creditTopCategories: data.creditTopCategories,
    dataFreshnessRows: data.dataFreshnessRows,
    error: data.errorMessage,
    kpis: data.kpis,
    lastAccountSyncAt: data.lastAccountSyncAt,
    lastAnalysisAt: data.lastAnalysisAt,
    lastWeeklyInsightsAt: data.lastWeeklyInsightsAt,
    loadDashboardData: data.loadDashboardData,
    monthlyTrend: data.monthlyTrend,
    ownerResponsibility: data.ownerResponsibility,
    recentTransactions: data.recentTransactions,
    upcomingRenewals: data.upcomingRenewals,
  }
}
