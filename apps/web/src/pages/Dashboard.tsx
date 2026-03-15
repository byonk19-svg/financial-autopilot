import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardAttentionCard } from '@/components/dashboard/DashboardAttentionCard'
import { DashboardAutopilotMetricsCard } from '@/components/dashboard/DashboardAutopilotMetricsCard'
import { DashboardDeferredSection } from '@/components/dashboard/DashboardDeferredSection'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardLoading } from '@/components/dashboard/DashboardLoading'
import { DashboardMonthlyTrendCard } from '@/components/dashboard/DashboardMonthlyTrendCard'
import { DashboardOwnerResponsibilityCard } from '@/components/dashboard/DashboardOwnerResponsibilityCard'
import { DashboardRecentTransactionsCard } from '@/components/dashboard/DashboardRecentTransactionsCard'
import { DashboardStatsGrid } from '@/components/dashboard/DashboardStatsGrid'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/hooks/useDashboard'
import { useSession } from '@/lib/session'

const loadDashboardSpendByCategoryCard = () => import('@/components/dashboard/DashboardSpendByCategoryCard')

const DashboardSpendByCategoryCard = lazy(async () => {
  const module = await loadDashboardSpendByCategoryCard()
  return { default: module.DashboardSpendByCategoryCard }
})

const DashboardShiftWeekCard = lazy(async () => {
  const module = await import('@/components/dashboard/DashboardShiftWeekCard')
  return { default: module.DashboardShiftWeekCard }
})

const DashboardSavingsBucketsCard = lazy(async () => {
  const module = await import('@/components/dashboard/DashboardSavingsBucketsCard')
  return { default: module.DashboardSavingsBucketsCard }
})

const DashboardUpcomingRenewalsCard = lazy(async () => {
  const module = await import('@/components/dashboard/DashboardUpcomingRenewalsCard')
  return { default: module.DashboardUpcomingRenewalsCard }
})

const DashboardDataFreshnessCard = lazy(async () => {
  const module = await import('@/components/dashboard/DashboardDataFreshnessCard')
  return { default: module.DashboardDataFreshnessCard }
})

const DashboardSystemHealthCard = lazy(async () => {
  const module = await import('@/components/dashboard/DashboardSystemHealthCard')
  return { default: module.DashboardSystemHealthCard }
})

const InsightFeed = lazy(() => import('@/components/InsightFeed'))

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [showSpendSection, setShowSpendSection] = useState(false)
  const [showSupplementalSection, setShowSupplementalSection] = useState(false)
  const [showSidebarSection, setShowSidebarSection] = useState(false)

  const {
    checkingConnection,
    needsConnection,
    attentionCounts,
    autopilotMetrics,
    creditSpendMtd,
    creditTopCategories,
    ownerResponsibility,
    kpis,
    anomalies,
    upcomingRenewals,
    renewalMonthlyTotal,
    monthlyTrend,
    recentTransactions,
    lastAccountSyncAt,
    dataFreshnessRows,
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
    onRepairLast6Months,
    shiftSummary,
    savingsSummary,
    shiftLoading,
    savingsLoading,
  } = useDashboard(session?.user?.id, {
    loadHealth: showSidebarSection,
    loadSupplemental: showSupplementalSection,
  })

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

  const preloadSpendSection = useCallback(() => {
    void loadDashboardSpendByCategoryCard()
  }, [])

  const handleLoadSpendSection = useCallback(() => {
    preloadSpendSection()
    setShowSpendSection(true)
  }, [preloadSpendSection])

  if (loading || checkingConnection || !session?.user || needsConnection) {
    return <DashboardLoading />
  }

  return (
    <section
      className="w-full max-w-[1400px] space-y-7 lg:space-y-8"
      aria-busy={syncing || (showSidebarSection && healthLoading)}
    >
      <DashboardHeader
        syncing={syncing}
        message={message}
        error={error}
        syncNeedsReconnect={syncNeedsReconnect}
        onSyncNow={handleSyncNowClick}
        onRepairLast6Months={onRepairLast6Months}
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]" aria-label="Dashboard trends and recent activity">
        <DashboardMonthlyTrendCard rows={monthlyTrend} />
        <DashboardRecentTransactionsCard recentTransactions={recentTransactions} />
      </section>

      <section aria-labelledby="dashboard-spend-heading">
        <Suspense fallback={<DashboardCardFallback minHeightClassName="min-h-[24rem]" />}>
          {showSpendSection ? (
            <DashboardSpendByCategoryCard />
          ) : (
            <DashboardSpendPreviewCard
              topCategories={creditTopCategories}
              spendMtd={creditSpendMtd}
              onLoad={handleLoadSpendSection}
              onPrefetch={preloadSpendSection}
            />
          )}
        </Suspense>
      </section>

      <DashboardDeferredSection
        className="grid gap-5 md:grid-cols-2 xl:gap-6"
        fallback={<DashboardTwoColumnFallback />}
        onVisible={() => setShowSupplementalSection(true)}
      >
        <Suspense fallback={<DashboardTwoColumnFallback />}>
          {showSupplementalSection ? (
            <>
              <DashboardShiftWeekCard shiftSummary={shiftSummary} shiftLoading={shiftLoading} />
              <DashboardSavingsBucketsCard savingsSummary={savingsSummary} savingsLoading={savingsLoading} />
              <DashboardUpcomingRenewalsCard upcomingRenewals={upcomingRenewals} />
            </>
          ) : null}
        </Suspense>
      </DashboardDeferredSection>

      <DashboardDeferredSection
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:gap-7"
        fallback={<DashboardLowerContentFallback />}
        onVisible={() => setShowSidebarSection(true)}
      >
        <section aria-labelledby="dashboard-content-heading">
          <h2 id="dashboard-content-heading" className="sr-only">
            Dashboard content
          </h2>
          <section aria-labelledby="insight-feed-heading">
            <h3 id="insight-feed-heading" className="sr-only">
              Insight feed
            </h3>
            <div aria-live="polite">
              <Suspense fallback={<DashboardCardFallback minHeightClassName="min-h-[14rem]" />}>
                {showSidebarSection ? <InsightFeed userId={session.user.id} /> : null}
              </Suspense>
            </div>
          </section>
        </section>

        <aside
          className="space-y-4 lg:sticky lg:top-[5.4rem] lg:self-start"
          aria-label="Dashboard sidebar"
        >
          <Suspense fallback={<DashboardSidebarFallback />}>
            {showSidebarSection ? (
              <>
                <DashboardDataFreshnessCard
                  lastAccountSyncAt={lastAccountSyncAt}
                  rows={dataFreshnessRows}
                />
                <DashboardSystemHealthCard
                  healthLoading={healthLoading}
                  healthError={healthError}
                  systemHealth={systemHealth}
                  lastAccountSyncAt={lastAccountSyncAt}
                  lastAnalysisAt={lastAnalysisAt}
                  lastWeeklyInsightsAt={lastWeeklyInsightsAt}
                />
              </>
            ) : null}
          </Suspense>
        </aside>
      </DashboardDeferredSection>
    </section>
  )
}

function DashboardCardFallback({ minHeightClassName = 'min-h-[16rem]' }: { minHeightClassName?: string }) {
  return (
    <div className={`rounded-3xl border border-border/75 bg-card/95 p-6 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)] ${minHeightClassName}`}>
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted/80" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
      </div>
    </div>
  )
}

function DashboardTwoColumnFallback() {
  return (
    <>
      <DashboardCardFallback minHeightClassName="min-h-[18rem]" />
      <DashboardCardFallback minHeightClassName="min-h-[18rem]" />
      <DashboardCardFallback minHeightClassName="min-h-[14rem]" />
    </>
  )
}

function DashboardSidebarFallback() {
  return (
    <>
      <DashboardCardFallback minHeightClassName="min-h-[12rem]" />
      <DashboardCardFallback minHeightClassName="min-h-[20rem]" />
    </>
  )
}

function DashboardLowerContentFallback() {
  return (
    <>
      <DashboardCardFallback minHeightClassName="min-h-[14rem]" />
      <DashboardSidebarFallback />
    </>
  )
}

function DashboardSpendPreviewCard({
  topCategories,
  spendMtd,
  onLoad,
  onPrefetch,
}: {
  topCategories: Array<{ category: string; amount: number }>
  spendMtd: number
  onLoad: () => void
  onPrefetch: () => void
}) {
  const maxAmount = topCategories.reduce((max, row) => Math.max(max, row.amount), 0)

  return (
    <div className="rounded-3xl border border-border/75 bg-card/95 p-6 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dashboard-spend-heading" className="text-base font-semibold text-foreground">
            Spend by Category
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Credit card purchase spend only (expenses).
          </p>
        </div>
        {spendMtd > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Credit spend MTD</p>
            <p className="text-xl font-semibold tabular-nums text-foreground">{formatCurrency(spendMtd)}</p>
          </div>
        )}
      </div>

      {topCategories.length > 0 ? (
        <div className="space-y-3">
          {topCategories.slice(0, 5).map((row) => (
            <div key={row.category} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="truncate font-medium text-foreground">{row.category}</p>
                <p className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(row.amount)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/55">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No credit-card category spend has been recorded for this month yet.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLoad}
          onMouseEnter={onPrefetch}
          onFocus={onPrefetch}
        >
          View interactive chart
        </Button>
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}
