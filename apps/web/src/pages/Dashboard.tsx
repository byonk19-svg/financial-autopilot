import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardLoading } from '@/components/dashboard/DashboardLoading'
import { DashboardStatsGrid } from '@/components/dashboard/DashboardStatsGrid'
import { DashboardSystemHealthCard } from '@/components/dashboard/DashboardSystemHealthCard'
import InsightFeed from '@/components/InsightFeed'
import { useDashboard } from '@/hooks/useDashboard'
import { useSession } from '@/lib/session'

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const {
    checkingConnection,
    needsConnection,
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
    onSyncNow,
  } = useDashboard(session?.user?.id)

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    if (needsConnection) {
      navigate('/connect', { replace: true })
    }
  }, [loading, navigate, needsConnection, session])

  const handleSyncNowClick = useCallback(() => {
    void onSyncNow()
  }, [onSyncNow])

  if (loading || checkingConnection || !session?.user || needsConnection) {
    return <DashboardLoading />
  }

  return (
    <main className="space-y-4" aria-busy={syncing || healthLoading}>
      <DashboardHeader syncing={syncing} message={message} error={error} onSyncNow={handleSyncNowClick} />

      <DashboardStatsGrid
        kpis={kpis}
        anomalies={anomalies}
        upcomingRenewals={upcomingRenewals}
        renewalMonthlyTotal={renewalMonthlyTotal}
      />

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]" aria-labelledby="dashboard-content-heading">
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

        <aside className="space-y-3" aria-label="Dashboard sidebar">
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
    </main>
  )
}
