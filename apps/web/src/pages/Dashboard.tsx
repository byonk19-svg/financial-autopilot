import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardAttentionCard } from '@/components/dashboard/DashboardAttentionCard'
import { DashboardAutopilotMetricsCard } from '@/components/dashboard/DashboardAutopilotMetricsCard'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardLoading } from '@/components/dashboard/DashboardLoading'
import { DashboardOwnerResponsibilityCard } from '@/components/dashboard/DashboardOwnerResponsibilityCard'
import { DashboardSavingsBucketsCard } from '@/components/dashboard/DashboardSavingsBucketsCard'
import { DashboardShiftWeekCard } from '@/components/dashboard/DashboardShiftWeekCard'
import { DashboardStatsGrid } from '@/components/dashboard/DashboardStatsGrid'
import { DashboardSystemHealthCard } from '@/components/dashboard/DashboardSystemHealthCard'
import { DashboardUpcomingRenewalsCard } from '@/components/dashboard/DashboardUpcomingRenewalsCard'
import InsightFeed from '@/components/InsightFeed'
import { useDashboard } from '@/hooks/useDashboard'
import { useSession } from '@/lib/session'

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const {
    checkingConnection,
    needsConnection,
    attentionCounts,
    autopilotMetrics,
    ownerResponsibility,
    kpis,
    anomalies,
    upcomingRenewals,
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
  } = useDashboard(session?.user?.id)

  useEffect(() => {
    if (loading) return
    if (sessionExpired) {
      navigate('/login', { replace: true })
      return
    }
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    if (needsConnection) {
      navigate('/connect', { replace: true })
    }
  }, [loading, navigate, needsConnection, session, sessionExpired])

  const handleSyncNowClick = useCallback(() => {
    void onSyncNow()
  }, [onSyncNow])

  const handleReconnect = useCallback(() => {
    navigate('/connect')
  }, [navigate])

  if (loading || checkingConnection || !session?.user || needsConnection) {
    return <DashboardLoading />
  }

  return (
    <section
      className="w-full max-w-[1400px] space-y-7 lg:space-y-8"
      aria-busy={syncing || healthLoading}
    >
      <DashboardHeader
        syncing={syncing}
        message={message}
        error={error}
        syncNeedsReconnect={syncNeedsReconnect}
        onSyncNow={handleSyncNowClick}
        onReconnect={handleReconnect}
      />

      <DashboardAttentionCard counts={attentionCounts} />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Autopilot and ownership metrics">
        <DashboardAutopilotMetricsCard metrics={autopilotMetrics} />
        <DashboardOwnerResponsibilityCard ownerResponsibility={ownerResponsibility} />
      </section>

      <DashboardStatsGrid
        kpis={kpis}
        anomalies={anomalies}
        upcomingRenewals={upcomingRenewals}
        renewalMonthlyTotal={renewalMonthlyTotal}
      />

      <section
        className="grid gap-5 md:grid-cols-2 xl:gap-6"
        aria-label="Shift, savings, and renewal details"
      >
        <DashboardShiftWeekCard shiftSummary={shiftSummary} shiftLoading={shiftLoading} />
        <DashboardSavingsBucketsCard savingsSummary={savingsSummary} savingsLoading={savingsLoading} />
        <DashboardUpcomingRenewalsCard upcomingRenewals={upcomingRenewals} />
      </section>

      <section
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:gap-7"
        aria-labelledby="dashboard-content-heading"
      >
        <h2 id="dashboard-content-heading" className="sr-only">
          Dashboard content
        </h2>
        <section aria-labelledby="insight-feed-heading">
          <h3 id="insight-feed-heading" className="sr-only">
            Insight feed
          </h3>
          <div aria-live="polite">
            <InsightFeed userId={session.user.id} />
          </div>
        </section>

        <aside
          className="space-y-4 lg:sticky lg:top-[5.4rem] lg:self-start"
          aria-label="Dashboard sidebar"
        >
          <DashboardSystemHealthCard
            healthLoading={healthLoading}
            healthError={healthError}
            systemHealth={systemHealth}
            lastAccountSyncAt={lastAccountSyncAt}
            lastAnalysisAt={lastAnalysisAt}
            lastWeeklyInsightsAt={lastWeeklyInsightsAt}
          />
        </aside>
      </section>
    </section>
  )
}
