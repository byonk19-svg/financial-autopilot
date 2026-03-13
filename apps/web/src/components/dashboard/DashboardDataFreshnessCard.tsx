import { ActivityIcon } from "@/components/dashboard/DashboardIcons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardDataFreshnessRow } from "@/hooks/useDashboard";
import { formatShortDateTime } from "@/lib/formatting";

type DashboardDataFreshnessCardProps = {
  lastAccountSyncAt: string | null;
  rows: DashboardDataFreshnessRow[];
};

export function DashboardDataFreshnessCard({ lastAccountSyncAt, rows }: DashboardDataFreshnessCardProps) {
  const staleCount = rows.filter((row) => row.isStale).length;

  return (
    <Card aria-labelledby="data-freshness-heading" className="border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-3">
        <CardTitle
          id="data-freshness-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-muted-foreground"
        >
          <ActivityIcon className="h-4 w-4 text-primary/75" />
          Data Freshness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p>
            Last sync: <span className="font-semibold text-foreground">{formatShortDateTime(lastAccountSyncAt)}</span>
          </p>
          <p className="mt-1">
            Stale accounts (&gt; 7d since newest transaction):{" "}
            <span className="font-semibold text-foreground">{staleCount}</span>
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No connected accounts available.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.accountId}
                className={`rounded-lg border px-3 py-2 ${
                  row.isStale
                    ? "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.06)]"
                    : "border-border/70 bg-background/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.accountName}
                    {row.institution ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">({row.institution})</span>
                    ) : null}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      row.isStale
                        ? "bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning)/0.9)]"
                        : "bg-[hsl(var(--success)/0.16)] text-[hsl(var(--success)/0.9)]"
                    }`}
                  >
                    {row.isStale ? "Stale" : "Current"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Newest transaction: {formatShortDateTime(row.newestTransactionAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Account sync: {formatShortDateTime(row.lastSyncedAt)}
                  {row.staleDays !== null ? ` • ${row.staleDays}d ago` : " • no posted transactions yet"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
