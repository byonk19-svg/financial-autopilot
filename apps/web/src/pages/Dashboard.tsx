import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ActivityIcon,
  CalendarIcon,
  WalletIcon,
} from "@/components/dashboard/DashboardIcons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLoading } from "@/components/dashboard/DashboardLoading";
import { DashboardStatsGrid } from "@/components/dashboard/DashboardStatsGrid";
import { DashboardSystemHealthCard } from "@/components/dashboard/DashboardSystemHealthCard";
import InsightFeed from "@/components/InsightFeed";
import { useDashboard } from "@/hooks/useDashboard";
import { captureException } from "@/lib/errorReporting";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type NumberLike = number | string | null | undefined;

type ShiftSummaryRow = {
  shift_id: string;
  employer_name: string;
  location_name: string | null;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: NumberLike;
  gross_pay: NumberLike;
  status: string;
};

type ShiftBreakdownRow = {
  employer_name: string;
  hours: NumberLike;
  gross_pay: NumberLike;
};

type ShiftWeekSummaryRpc = {
  week_start: string;
  week_end: string;
  shifts: ShiftSummaryRow[] | null;
  total_hours: NumberLike;
  total_gross_pay: NumberLike;
  employer_breakdown: ShiftBreakdownRow[] | null;
};

type SavingsBucketSummaryRow = {
  bucket_id: string;
  name: string;
  owner: "brianna" | "elaine" | "household";
  target_amount: NumberLike;
  current_balance: NumberLike;
  allocation_pct: NumberLike;
  weekly_target: NumberLike;
  goal_date: string | null;
  priority: number;
  progress_pct: NumberLike;
  weeks_to_goal: number | null;
};

type SavingsBucketRow = {
  bucket_id: string;
  name: string;
  owner: "brianna" | "elaine" | "household";
  target_amount: number | null;
  current_balance: number | string | null;
  progress_pct: number | null;
  weeks_to_goal: number | null;
};

type SavingsBucketSummaryRpc = {
  buckets: SavingsBucketRow[] | null;
  total_saved: NumberLike;
  total_by_owner: {
    brianna?: NumberLike;
    elaine?: NumberLike;
    household?: NumberLike;
  } | null;
};

function toNumber(value: NumberLike): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: NumberLike): string {
  return `$${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeDateLabel(
  value: string | null | undefined,
  pattern: string,
): string {
  if (!value) return "N/A";
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

function ownerBadgeVariant(
  owner: SavingsBucketSummaryRow["owner"],
): "default" | "secondary" | "outline" {
  if (owner === "brianna") return "default";
  if (owner === "elaine") return "secondary";
  return "outline";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const {
    checkingConnection,
    needsConnection,
    kpis,
    anomalies,
    upcomingRenewals,
    renewalMonthlyTotal,
    lastAccountSyncAt,
    lastAnalysisAt,
    lastWeeklyInsightsAt,
    systemHealth,
    healthLoading,
    healthError,
    syncing,
    message,
    error,
    sessionExpired,
    syncNeedsReconnect,
    onSyncNow,
  } = useDashboard(session?.user?.id);

  const [shiftSummary, setShiftSummary] = useState<ShiftWeekSummaryRpc | null>(
    null,
  );
  const [savingsSummary, setSavingsSummary] =
    useState<SavingsBucketSummaryRpc | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [savingsLoading, setSavingsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (sessionExpired) {
      navigate("/login", { replace: true });
      return;
    }
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }
    if (needsConnection) {
      navigate("/connect", { replace: true });
    }
  }, [loading, navigate, needsConnection, session, sessionExpired]);

  const handleSyncNowClick = useCallback(() => {
    void onSyncNow();
  }, [onSyncNow]);

  const handleReconnect = useCallback(() => {
    navigate("/connect");
  }, [navigate]);

  useEffect(() => {
    if (!session?.user?.id) return;

    let active = true;

    const loadSupplemental = async () => {
      setShiftLoading(true);
      setSavingsLoading(true);

      try {
        const [shiftResult, savingsResult] = await Promise.all([
          supabase.rpc("shift_week_summary"),
          supabase.rpc("savings_bucket_summary"),
        ]);

        if (!active) return;

        if (shiftResult.error) throw shiftResult.error;
        if (savingsResult.error) throw savingsResult.error;

        setShiftSummary(
          (shiftResult.data ?? null) as ShiftWeekSummaryRpc | null,
        );
        setSavingsSummary(
          (savingsResult.data ?? null) as SavingsBucketSummaryRpc | null,
        );
      } catch (supplementalError) {
        if (!active) return;
        setShiftSummary(null);
        setSavingsSummary(null);
        captureException(supplementalError, {
          component: "Dashboard",
          action: "load-shift-and-savings-rpcs",
        });
      } finally {
        if (active) {
          setShiftLoading(false);
          setSavingsLoading(false);
        }
      }
    };

    void loadSupplemental();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const shiftRows = shiftSummary?.shifts ?? [];
  const shiftBreakdown = shiftSummary?.employer_breakdown ?? [];
  const savingsBuckets = savingsSummary?.buckets ?? [];

  const maxBreakdownPay = shiftBreakdown.reduce(
    (max, row) => Math.max(max, toNumber(row.gross_pay)),
    0,
  );

  if (loading || checkingConnection || !session?.user || needsConnection) {
    return <DashboardLoading />;
  }

  return (
    <section
      className="mx-auto w-full max-w-7xl space-y-6"
      aria-busy={syncing || healthLoading}
    >
      <DashboardHeader
        syncing={syncing}
        message={message}
        error={error}
        syncNeedsReconnect={syncNeedsReconnect}
        onSyncNow={handleSyncNowClick}
        onReconnect={handleReconnect}
      />

      <DashboardStatsGrid
        kpis={kpis}
        anomalies={anomalies}
        upcomingRenewals={upcomingRenewals}
        renewalMonthlyTotal={renewalMonthlyTotal}
      />

      <section
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
        aria-labelledby="dashboard-content-heading"
      >
        <h2 id="dashboard-content-heading" className="sr-only">
          Dashboard content
        </h2>
        <section aria-labelledby="insight-feed-heading">
          <h3 id="insight-feed-heading" className="sr-only">
            Insight feed
          </h3>
          <div aria-live="polite">
            <InsightFeed userId={session.user.id} />
          </div>
        </section>

        <aside className="space-y-4" aria-label="Dashboard sidebar">
          <DashboardSystemHealthCard
            healthLoading={healthLoading}
            healthError={healthError}
            systemHealth={systemHealth}
            lastAccountSyncAt={lastAccountSyncAt}
            lastAnalysisAt={lastAnalysisAt}
            lastWeeklyInsightsAt={lastWeeklyInsightsAt}
          />
        </aside>
      </section>

      <section
        className="grid gap-6 md:grid-cols-2"
        aria-label="Shift, savings, and renewal details"
      >
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">
              {shiftSummary
                ? `Week of ${safeDateLabel(shiftSummary.week_start, "MMM d")} - ${toNumber(shiftSummary.total_hours).toFixed(2)} hrs - ${formatCurrency(shiftSummary.total_gross_pay)}`
                : "This Week's Shifts"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {shiftLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : shiftRows.length === 0 ? (
              <EmptyState
                className="min-h-[132px]"
                icon={<ActivityIcon className="h-5 w-5" />}
                title="No shifts logged this week"
                description="As shifts are added, weekly totals and employer breakdown will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftRows.map((shift) => (
                    <TableRow key={shift.shift_id}>
                      <TableCell>
                        {safeDateLabel(shift.shift_date, "MMM d")}
                      </TableCell>
                      <TableCell>{shift.employer_name}</TableCell>
                      <TableCell>{shift.location_name || "--"}</TableCell>
                      <TableCell className="text-right">
                        {toNumber(shift.hours_worked).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(shift.gross_pay)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {shift.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!shiftLoading && shiftBreakdown.length > 0 && (
              <div className="space-y-3 border-t border-border pt-4">
                {shiftBreakdown.map((row) => {
                  const grossPay = toNumber(row.gross_pay);
                  const value =
                    maxBreakdownPay > 0
                      ? (grossPay / maxBreakdownPay) * 100
                      : 0;
                  return (
                    <div key={row.employer_name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <p className="font-medium text-foreground">
                          {row.employer_name}
                        </p>
                        <p className="text-muted-foreground">
                          {toNumber(row.hours).toFixed(2)} hrs -{" "}
                          {formatCurrency(row.gross_pay)}
                        </p>
                      </div>
                      <Progress value={value} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">
              Savings Buckets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {savingsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total saved
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {formatCurrency(savingsSummary?.total_saved)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Brianna:{" "}
                    {formatCurrency(savingsSummary?.total_by_owner?.brianna)} -
                    Elaine:{" "}
                    {formatCurrency(savingsSummary?.total_by_owner?.elaine)} -
                    Household:{" "}
                    {formatCurrency(savingsSummary?.total_by_owner?.household)}
                  </p>
                </div>

                {savingsBuckets.length === 0 ? (
                  <EmptyState
                    className="min-h-[132px]"
                    icon={<WalletIcon className="h-5 w-5" />}
                    title="No active savings buckets"
                    description="Create a bucket to start tracking savings goals and progress."
                  />
                ) : (
                  <div className="space-y-3">
                    {savingsBuckets.map((bucket) => {
                      const progressValue = Math.max(
                        0,
                        Math.min(100, toNumber(bucket.progress_pct) * 100),
                      );
                      return (
                        <div
                          key={bucket.bucket_id}
                          className="space-y-2 rounded-lg border border-border p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">
                              {bucket.name}
                            </p>
                            <Badge variant={ownerBadgeVariant(bucket.owner)}>
                              {bucket.owner}
                            </Badge>
                          </div>
                          <Progress value={progressValue} />
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <p>
                              {formatCurrency(bucket.current_balance)}
                              {bucket.target_amount == null
                                ? " / Open-ended"
                                : ` / ${formatCurrency(bucket.target_amount)}`}
                            </p>
                            {bucket.weeks_to_goal != null && (
                              <p>{bucket.weeks_to_goal} weeks to goal</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">
              Upcoming Renewals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingRenewals.length === 0 ? (
              <EmptyState
                className="min-h-[132px]"
                icon={<CalendarIcon className="h-5 w-5" />}
                title="No upcoming renewals"
                description="Subscription renewals due in the next 14 days will show here."
              />
            ) : (
              <ul className="space-y-2">
                {upcomingRenewals.map((renewal) => (
                  <li
                    key={renewal.subscription_id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {renewal.merchant_normalized}
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(renewal.last_amount)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Next renewal:{" "}
                      {safeDateLabel(renewal.next_expected_at, "MMM d, yyyy")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </section>
  );
}
