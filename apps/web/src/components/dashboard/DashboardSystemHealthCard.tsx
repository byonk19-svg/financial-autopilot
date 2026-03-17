import { ActivityIcon } from '@/components/dashboard/DashboardIcons'
import {
  getDashboardStatusUi,
  humanizeDashboardStatus,
} from '@/components/dashboard/dashboardStatus'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { SystemHealthPayload } from '@/hooks/useDashboard'
import { formatShortDateTime } from '@/lib/formatting'

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
  const latestError = systemHealth?.latest_error?.trim()

  return (
    <Card
      aria-labelledby="system-health-heading"
      className="border border-border/75 bg-card/95 shadow-[0_8px_18px_-20px_hsl(var(--foreground)/0.24)]"
    >
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle
          id="system-health-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-muted-foreground"
        >
          <ActivityIcon className="h-4 w-4 text-primary/75" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5 pt-0">
        {healthLoading ? (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2 rounded-lg border border-border p-2.5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ) : (
          <>
            <dl className="grid gap-3 text-sm">
              <MetadataRow label="Last account sync" value={formatShortDateTime(lastAccountSyncAt)} />
              <MetadataRow label="Last analysis run" value={formatShortDateTime(lastAnalysisAt)} />
              <MetadataRow label="Last weekly insights run" value={formatShortDateTime(lastWeeklyInsightsAt)} />
            </dl>

            {latestError && (
              <div className="rounded-xl border border-[hsl(var(--destructive)/0.2)] bg-[hsl(var(--destructive)/0.05)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Latest Error
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {latestError}
                </p>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/12 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ActivityIcon className="h-3.5 w-3.5 text-primary/75" />
                  Job Status
                </p>
                <p className="text-xs text-muted-foreground">
                  {systemHealth?.jobs?.length ?? 0} jobs
                </p>
              </div>

              {systemHealth?.jobs?.length ? (
                <div className="space-y-2">
                  {systemHealth.jobs.map((job) => {
                    const statusUi = getDashboardStatusUi(job.last_status)

                    return (
                      <div
                        key={job.job_name}
                        className="space-y-2 rounded-lg border border-border/80 bg-card/90 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{job.job_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Schedule {job.schedule ?? 'Not scheduled'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 rounded-full ${statusUi.dotClassName}`}
                            />
                            <Badge
                              variant="outline"
                              className={statusUi.badgeClassName}
                            >
                              {humanizeDashboardStatus(job.last_status)}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <MetadataRow label="Last run" value={formatShortDateTime(job.last_run_at)} />
                          {job.last_error ? (
                            <MetadataRow label="Last error" value={job.last_error} toneClassName="text-rose-900" />
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  className="min-h-[120px] bg-card/60"
                  icon={<ActivityIcon className="h-4 w-4" />}
                  title="No jobs found"
                  description="Job statuses will appear after scheduled jobs are detected."
                />
              )}
            </div>

            {healthError && (
              <div
                className="rounded-lg border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive)/0.06)] px-3 py-2 text-sm text-[hsl(var(--destructive)/0.9)]"
                role="alert"
                aria-live="polite"
              >
                {healthError}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MetadataRow({
  label,
  value,
  toneClassName = 'text-foreground',
}: {
  label: string
  value: string
  toneClassName?: string
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className={`break-words text-sm ${toneClassName}`}>{value}</dd>
    </div>
  )
}
