import { ActivityIcon } from "@/components/dashboard/DashboardIcons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { SystemHealthPayload } from "@/hooks/useDashboard";
import { statusDot, statusTone } from "@/hooks/useDashboard";
import { formatShortDateTime } from "@/lib/formatting";

type DashboardSystemHealthCardProps = {
  healthLoading: boolean;
  healthError: string;
  systemHealth: SystemHealthPayload | null;
  lastAccountSyncAt: string | null;
  lastAnalysisAt: string | null;
  lastWeeklyInsightsAt: string | null;
};

function formatStatusLabel(status: string | null): string {
  if (!status) return "Unknown";
  return status.replace(/[_-]+/g, " ").trim();
}

function statusBadgeClass(status: string | null): string {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("succeeded")) {
    return "border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]";
  }
  if (normalized.includes("running")) {
    return "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]";
  }
  if (normalized.includes("failed") || normalized.includes("error")) {
    return "border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]";
  }
  if (normalized.includes("missing") || normalized.includes("unavailable")) {
    return "border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function DashboardSystemHealthCard({
  healthLoading,
  healthError,
  systemHealth,
  lastAccountSyncAt,
  lastAnalysisAt,
  lastWeeklyInsightsAt,
}: DashboardSystemHealthCardProps) {
  const latestError = systemHealth?.latest_error?.trim();

  return (
    <Card aria-labelledby="system-health-heading" className="border border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.06)] shadow-[0_18px_34px_-28px_hsl(var(--foreground)/0.5)] motion-fade-up motion-stagger-3">
      <section>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle
            id="system-health-heading"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <ActivityIcon className="h-4 w-4 text-primary/80" />
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
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Last account sync</dt>
                  <dd className="text-foreground">
                    {formatShortDateTime(lastAccountSyncAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Last analysis run</dt>
                  <dd className="text-foreground">
                    {formatShortDateTime(lastAnalysisAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">
                    Last weekly insights run
                  </dt>
                  <dd className="text-foreground">
                    {formatShortDateTime(lastWeeklyInsightsAt)}
                  </dd>
                </div>
              </dl>

              {latestError && (
                <div className="rounded-xl border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.08)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest Error
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {latestError}
                  </p>
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-[hsl(var(--primary)/0.26)] bg-[hsl(var(--primary)/0.08)] p-3">
                <div className="flex items-center justify-between gap-2">
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
                    {systemHealth.jobs.map((job) => (
                      <div
                        key={job.job_name}
                        className="space-y-1.5 rounded-lg border border-border bg-card px-2.5 py-2 transition-colors duration-150 hover:bg-background/80"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {job.job_name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 rounded-full ${statusDot(job.last_status)}`}
                            />
                            <Badge
                              variant="outline"
                              className={statusBadgeClass(job.last_status)}
                            >
                              {formatStatusLabel(job.last_status)}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>Schedule: {job.schedule ?? "Not scheduled"}</p>
                          <p className={statusTone(job.last_status)}>
                            Last run: {formatShortDateTime(job.last_run_at)}
                          </p>
                        </div>
                        {job.last_error && (
                          <p className="text-xs text-[hsl(var(--destructive))]">
                            Error: {job.last_error}
                          </p>
                        )}
                      </div>
                    ))}
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
                  className="rounded-lg border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.1)] px-3 py-2 text-sm text-[hsl(var(--destructive))]"
                  role="alert"
                  aria-live="polite"
                >
                  {healthError}
                </div>
              )}
            </>
          )}
        </CardContent>
      </section>
    </Card>
  );
}
