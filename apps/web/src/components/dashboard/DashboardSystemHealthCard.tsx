import { ActivityIcon } from '@/components/dashboard/DashboardIcons'
import type { SystemHealthPayload } from '@/hooks/useDashboard'
import { formatDateTime, statusDot, statusTone } from '@/hooks/useDashboard'

type DashboardSystemHealthCardProps = {
  healthLoading: boolean
  healthError: string
  systemHealth: SystemHealthPayload | null
  lastAccountSyncAt: string | null
  lastAnalysisAt: string | null
  lastWeeklyInsightsAt: string | null
}

export function DashboardSystemHealthCard({
  healthLoading,
  healthError,
  systemHealth,
  lastAccountSyncAt,
  lastAnalysisAt,
  lastWeeklyInsightsAt,
}: DashboardSystemHealthCardProps) {
  return (
    <section className="rounded-xl border border bg-card p-5 shadow-sm" aria-labelledby="system-health-heading">
      <h3
        id="system-health-heading"
        className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <ActivityIcon className="h-4 w-4 text-primary/80" />
        System Health
      </h3>
      {healthLoading ? (
        <div className="mt-3 space-y-2" aria-live="polite" aria-busy="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/70" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted/70" />
        </div>
      ) : (
        <>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Last account sync</dt>
              <dd className="text-foreground">{formatDateTime(lastAccountSyncAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Last analysis run</dt>
              <dd className="text-foreground">{formatDateTime(lastAnalysisAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Last weekly insights run</dt>
              <dd className="text-foreground">{formatDateTime(lastWeeklyInsightsAt)}</dd>
            </div>
          </dl>

          <div className="mt-3 rounded-lg border border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Error</p>
            <p className="mt-1 text-sm text-foreground">{systemHealth?.latest_error ?? 'None'}</p>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job Status</p>
            {systemHealth?.jobs?.map((job) => (
              <div key={job.job_name} className="rounded-lg border border bg-card p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{job.job_name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${statusDot(job.last_status)}`} />
                    <span className={`text-xs font-medium ${statusTone(job.last_status)}`}>
                      {job.last_status ?? 'unknown'}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Schedule: {job.schedule ?? 'Not scheduled'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last run: {formatDateTime(job.last_run_at)}</p>
                {job.last_error && <p className="mt-1 text-xs text-rose-700">Error: {job.last_error}</p>}
              </div>
            ))}
          </div>

          {healthError && (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {healthError}
            </div>
          )}
        </>
      )}
    </section>
  )
}
