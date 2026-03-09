import { RefreshIcon } from "@/components/dashboard/DashboardIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardHeaderProps = {
  syncing: boolean;
  message: string;
  error: string;
  syncNeedsReconnect: boolean;
  onSyncNow: () => void;
  onReconnect: () => void;
};

export function DashboardHeader({
  syncing,
  message,
  error,
  syncNeedsReconnect,
  onSyncNow,
  onReconnect,
}: DashboardHeaderProps) {
  return (
    <Card
      aria-labelledby="dashboard-heading"
      className="overflow-hidden border border-border/80 bg-card/95 shadow-[0_18px_36px_-26px_hsl(var(--foreground)/0.45)] motion-fade-up motion-stagger-1"
    >
      <div
        className="h-1.5 w-full bg-gradient-to-r from-[hsl(var(--chart-1)/0.8)] via-[hsl(var(--primary)/0.82)] to-[hsl(var(--chart-2)/0.76)]"
        aria-hidden="true"
      />
      <section>
        <CardHeader className="pb-4 sm:pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle
                id="dashboard-heading"
                className="text-[clamp(1.45rem,2.7vw,2rem)] font-extrabold tracking-tight"
              >
                Financial Autopilot
              </CardTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">
                A clearer command center for cash flow, spending signals, and
                recurring obligations.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.12)] px-2.5 py-1 text-[hsl(var(--success))]">
                  Connected data
                </span>
                <span className="rounded-full border border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.09)] px-2.5 py-1 text-primary">
                  Weekly insights enabled
                </span>
              </div>
            </div>
            <Button
              onClick={onSyncNow}
              disabled={syncing}
              className="min-w-[8.75rem] shadow-[0_12px_24px_-14px_hsl(var(--primary)/0.8)]"
            >
              <RefreshIcon
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {message && (
            <div
              className="rounded-xl border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.12)] px-3 py-2 text-sm text-[hsl(var(--success))]"
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}
          {error && (
            <div
              className="rounded-xl border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.1)] px-3 py-2 text-sm text-[hsl(var(--destructive))]"
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
                    className="border-[hsl(var(--destructive)/0.35)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.16)] hover:text-[hsl(var(--destructive))]"
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
