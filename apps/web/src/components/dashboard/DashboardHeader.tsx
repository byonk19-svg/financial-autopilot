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
      className="overflow-hidden border border-border/80 bg-card/95"
    >
      <div
        className="h-1.5 w-full bg-gradient-to-r from-cyan-500/80 via-primary/80 to-emerald-500/70"
        aria-hidden="true"
      />
      <section>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle
                id="dashboard-heading"
                className="text-2xl font-extrabold tracking-tight"
              >
                Financial Autopilot
              </CardTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">
                A clearer command center for cash flow, spending signals, and
                recurring obligations.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  Connected data
                </span>
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  Weekly insights enabled
                </span>
              </div>
            </div>
            <Button
              onClick={onSyncNow}
              disabled={syncing}
              className="shadow-[0_12px_24px_-14px_hsl(var(--primary)/0.8)]"
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
              className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700"
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700"
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
                    className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-700"
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
