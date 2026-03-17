import { RefreshIcon } from "@/components/dashboard/DashboardIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
      className="overflow-hidden border border-border/70 bg-card/95 shadow-[0_10px_22px_-22px_hsl(var(--foreground)/0.26)]"
    >
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Dashboard
            </p>
            <h1
              id="dashboard-heading"
              className="text-[clamp(1.3rem,2.2vw,1.7rem)] font-semibold tracking-tight text-foreground"
            >
              Family planner desk
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Refresh the timeline when something changed. Use repair only if recent checking activity looks incomplete.
            </p>
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
            <p className="max-w-[24rem] text-xs text-muted-foreground">
              Repair re-reads recent history to catch late postings. SimpleFIN usually updates daily, so repeated repair runs can hit provider limits.
            </p>
          </div>
        </div>
        <div className="space-y-3">
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
        </div>
      </CardContent>
    </Card>
  );
}
