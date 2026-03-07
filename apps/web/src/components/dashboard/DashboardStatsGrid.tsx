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
  if (value > 0) return "text-rose-700";
  if (value < 0) return "text-emerald-700";
  return "text-muted-foreground";
}

export function DashboardStatsGrid({
  kpis,
  upcomingRenewals,
  anomalies,
  renewalMonthlyTotal,
}: DashboardStatsGridProps) {
  const kpiCardClass =
    "border border-border/80 bg-card/95 shadow-[0_14px_34px_-26px_hsl(var(--foreground)/0.45)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-24px_hsl(var(--foreground)/0.5)]"

  return (
    <section
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Dashboard KPI cards"
    >
      <Card className={kpiCardClass}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Cash Flow MTD
            </p>
            <DollarIcon className="h-5 w-5 text-primary/80" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {toCurrency(kpis.cashFlowMtd)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Income</dt>
              <dd className="font-medium text-emerald-700">
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

      <Card className={kpiCardClass}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Spend vs Last Month
            </p>
            <WalletIcon className="h-5 w-5 text-primary/80" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
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

      <Card className={kpiCardClass}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Top Categories MTD
            </p>
            <ChevronRightIcon className="h-5 w-5 text-primary/70" />
          </div>
          {kpis.topCategories.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No spending categories this month.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {kpis.topCategories.slice(0, 4).map((row) => (
                <li
                  key={row.category}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-foreground">
                    {row.category}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    {toCurrency(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={kpiCardClass}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Upcoming Renewals (14d)
            </p>
            <CalendarIcon className="h-5 w-5 text-primary/80" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {upcomingRenewals.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Monthly equivalent: {toCurrency(renewalMonthlyTotal)}
          </p>
          <ul className="mt-3 space-y-2">
            {upcomingRenewals.slice(0, 3).map((row) => (
              <li
                key={row.subscription_id}
                className="flex items-center justify-between gap-2 text-sm"
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
            className="mt-3 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View renewals
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card className={`${kpiCardClass} md:col-span-2 xl:col-span-2`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Unusual Charges
            </p>
            <AlertTriangleIcon className="h-5 w-5 text-rose-500" />
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
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">
                      {row.merchant_canonical}
                    </span>
                    <span className="text-rose-700">
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
            className="mt-3 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Review transactions
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
