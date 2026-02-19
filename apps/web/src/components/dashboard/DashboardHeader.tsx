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
    <Card aria-labelledby="dashboard-heading">
      <section>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle
                id="dashboard-heading"
                className="text-2xl font-semibold tracking-tight"
              >
                Financial Autopilot
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Automation-ready dashboard and weekly insight feed.
              </p>
            </div>
            <Button
              onClick={onSyncNow}
              disabled={syncing}
              className="shadow-sm"
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
              className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700"
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700"
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
