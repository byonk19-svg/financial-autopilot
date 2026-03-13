import { Link } from "react-router-dom";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  DollarIcon,
  WalletIcon,
} from "@/components/dashboard/DashboardIcons";
import { Card, CardContent } from "@/components/ui/card";
import type {
  DashboardAnomalyRow,
  DashboardKpis,
  DashboardRenewalRow,
} from "@/hooks/useDashboard";
import { toCurrency, toNumber } from "@/lib/subscriptionFormatters";

type DashboardStatsGridProps = {
  kpis: DashboardKpis;
  upcomingRenewals: DashboardRenewalRow[];
  anomalies: DashboardAnomalyRow[];
  renewalMonthlyTotal: number;
};

function toPercent(value: number | null): string {
  if (value === null) return "n/a";
  const pct = value * 100;
  const formatted = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  return `${formatted}%`;
}

function toneForDelta(value: number): string {
  if (value > 0) return "text-[hsl(var(--destructive))]";
  if (value < 0) return "text-[hsl(var(--success))]";
  return "text-muted-foreground";
}

export function DashboardStatsGrid({
  kpis,
  upcomingRenewals,
  anomalies,
  renewalMonthlyTotal,
}: DashboardStatsGridProps) {
  const kpiCardClass =
    "group border border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)] transition-colors duration-150 hover:bg-card"

  return (
    <section
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Dashboard KPI cards"
    >
      <Card className={`${kpiCardClass} border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.04)]`}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Cash Flow MTD
            </p>
            <DollarIcon className="h-5 w-5 text-[hsl(var(--success)/0.85)]" />
          </div>
          <p className="mt-2 text-[clamp(1.35rem,2.4vw,1.7rem)] font-semibold text-foreground">
            {toCurrency(kpis.cashFlowMtd)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Income</dt>
              <dd className="font-medium text-[hsl(var(--success)/0.9)]">
                {toCurrency(kpis.incomeMtd)}
              </dd>
              {(kpis.incomeBrianna > 0 || kpis.incomeElaine > 0) && (
                <dd className="mt-0.5 text-muted-foreground">
                  B: {toCurrency(kpis.incomeBrianna)} - E:{" "}
                  {toCurrency(kpis.incomeElaine)}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-muted-foreground">Spend</dt>
              <dd className="font-medium text-foreground">
                {toCurrency(kpis.spendMtd)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className={`${kpiCardClass} border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.04)]`}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Spend vs Last Month
            </p>
            <WalletIcon className="h-5 w-5 text-primary/85" />
          </div>
          <p className="mt-2 text-[clamp(1.35rem,2.4vw,1.7rem)] font-semibold text-foreground">
            {toCurrency(kpis.spendMtd)}
          </p>
          <p
            className={`mt-2 text-sm font-medium ${toneForDelta(kpis.spendDelta)}`}
          >
            {kpis.spendDelta > 0 ? "+" : ""}
            {toCurrency(kpis.spendDelta)} ({toPercent(kpis.spendDeltaPct)})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last month comparable: {toCurrency(kpis.spendLastMonth)}
          </p>
        </CardContent>
      </Card>

      <Card className={`${kpiCardClass} border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning)/0.05)]`}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Upcoming Renewals (14d)
            </p>
            <CalendarIcon className="h-5 w-5 text-[hsl(var(--warning)/0.85)]" />
          </div>
          <p className="mt-2 text-[clamp(1.35rem,2.4vw,1.7rem)] font-semibold text-foreground">
            {upcomingRenewals.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Monthly equivalent: {toCurrency(renewalMonthlyTotal)}
          </p>
          <ul className="mt-3 space-y-2">
            {upcomingRenewals.slice(0, 3).map((row) => (
              <li
                key={row.subscription_id}
                className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors group-hover:border-border/80 group-hover:bg-muted/35"
              >
                <span className="truncate text-foreground">
                  {row.merchant_normalized}
                </span>
                <span className="text-muted-foreground">
                  {row.days_until === null ? "n/a" : `${row.days_until}d`} -{" "}
                  {toCurrency(toNumber(row.last_amount))}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/subscriptions"
            className="mt-3 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View renewals
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card className={`${kpiCardClass} border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive)/0.04)] md:col-span-2 xl:col-span-2`}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Unusual Charges
            </p>
            <AlertTriangleIcon className="h-5 w-5 text-destructive/85" />
          </div>
          {anomalies.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No strong anomalies detected recently.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {anomalies.slice(0, 5).map((row) => (
                <li
                  key={row.transaction_id}
                  className="rounded-lg border border-[hsl(var(--destructive)/0.18)] bg-[hsl(var(--destructive)/0.03)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">
                      {row.merchant_canonical}
                    </span>
                    <span className="text-[hsl(var(--destructive)/0.9)]">
                      {toCurrency(toNumber(row.amount))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.reason ?? "Flagged by anomaly detector."}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/transactions"
            className="mt-3 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Review transactions
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
