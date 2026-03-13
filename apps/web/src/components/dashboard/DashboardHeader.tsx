import { RefreshIcon } from "@/components/dashboard/DashboardIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardHeaderProps = {
  syncing: boolean;
  message: string;
  error: string;
  syncNeedsReconnect: boolean;
  onSyncNow: () => void;
  onRepairLast6Months: () => void;
  onReconnect: () => void;
};

export function DashboardHeader({
  syncing,
  message,
  error,
  syncNeedsReconnect,
  onSyncNow,
  onRepairLast6Months,
  onReconnect,
}: DashboardHeaderProps) {
  return (
    <Card
      aria-labelledby="dashboard-heading"
      className="overflow-hidden border border-border/70 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]"
    >
      <div
        className="h-px w-full bg-border/70"
        aria-hidden="true"
      />
      <section>
        <CardHeader className="pb-4 sm:pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle
                id="dashboard-heading"
                className="text-[clamp(1.35rem,2.4vw,1.8rem)] font-semibold tracking-tight"
              >
                Financial Autopilot
              </CardTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">
                A clearer command center for cash flow, spending signals, and
                recurring obligations.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-foreground/80">
                  Connected data
                </span>
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-muted-foreground">
                  Weekly insights enabled
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={onSyncNow}
                  disabled={syncing}
                  className="min-w-[8.75rem] shadow-none hover:translate-y-0"
                >
                  <RefreshIcon
                    className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync now"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRepairLast6Months}
                  disabled={syncing}
                  className="min-w-[11rem]"
                >
                  Repair last 6 months
                </Button>
              </div>
              <p className="max-w-[22rem] text-xs text-muted-foreground">
                Repair re-reads the recent timeline to catch late postings. SimpleFIN updates roughly daily and
                aggressive re-runs can hit provider limits.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {message && (
            <div
              className="rounded-xl border border-border bg-muted/45 px-3 py-2 text-sm text-foreground/85"
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}
          {error && (
            <div
              className="rounded-xl border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive)/0.06)] px-3 py-2 text-sm text-[hsl(var(--destructive)/0.9)]"
              role="alert"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{error}</span>
                {syncNeedsReconnect && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onReconnect}
                    className="border-[hsl(var(--destructive)/0.28)] text-[hsl(var(--destructive)/0.9)] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive)/0.9)]"
                  >
                    Reconnect SimpleFIN
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </section>
    </Card>
  );
}
