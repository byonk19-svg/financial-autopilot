import { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, isSameMonth, startOfMonth, subMonths } from "date-fns";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpendByCategory } from "@/hooks/useSpendByCategory";
import { buildBarCategoryRows, buildDonutCategoryRows } from "@/lib/categoryChart";
import { toCurrency } from "@/lib/subscriptionFormatters";

const CATEGORY_COLOR_TOKENS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const;
const MONTH_OPTIONS_COUNT = 18;

type MonthOption = {
  value: string;
  label: string;
  monthStart: Date;
};

function chartColor(index: number): string {
  return `hsl(var(${CATEGORY_COLOR_TOKENS[index % CATEGORY_COLOR_TOKENS.length]}))`;
}

function buildMonthOptions(now: Date): MonthOption[] {
  return Array.from({ length: MONTH_OPTIONS_COUNT }, (_, index) => {
    const monthStart = startOfMonth(subMonths(now, index));
    return {
      value: format(monthStart, "yyyy-MM"),
      label: format(monthStart, "MMM yyyy"),
      monthStart,
    };
  });
}

function parseMonthValue(value: string): Date {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return startOfMonth(new Date());
  return new Date(year, month - 1, 1);
}

type SpendTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: { category?: string; amount?: number } }>;
};

function SpendTooltip({ active, payload }: SpendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as { category?: string; amount?: number } | undefined;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-2 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{point.category ?? "Unknown"}</p>
      <p className="mt-0.5 text-muted-foreground">{toCurrency(point.amount ?? 0)}</p>
    </div>
  );
}

export function DashboardSpendByCategoryCard() {
  const now = new Date();
  const monthOptions = useMemo(() => buildMonthOptions(new Date()), []);
  const currentMonthValue = monthOptions[0].value;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [toDate, setToDate] = useState(true);

  const selectedMonthStart = useMemo(() => startOfMonth(parseMonthValue(selectedMonth)), [selectedMonth]);
  const isCurrentMonth = isSameMonth(selectedMonthStart, now);
  const effectiveToDate = isCurrentMonth ? toDate : false;
  const selectedMonthEnd = effectiveToDate ? now : endOfMonth(selectedMonthStart);

  useEffect(() => {
    if (isCurrentMonth) {
      setToDate(true);
    }
  }, [isCurrentMonth, selectedMonth]);

  const startDate = format(selectedMonthStart, "yyyy-MM-dd");
  const endDate = format(selectedMonthEnd, "yyyy-MM-dd");
  const { rows, loading, error, total } = useSpendByCategory(startDate, endDate);

  const donutRows = useMemo(() => buildDonutCategoryRows(rows), [rows]);
  const barRows = useMemo(() => buildBarCategoryRows(rows), [rows]);
  const periodLabel = effectiveToDate
    ? `${format(selectedMonthStart, "MMM d")} - ${format(selectedMonthEnd, "MMM d, yyyy")}`
    : format(selectedMonthStart, "MMMM yyyy");

  return (
    <Card className="border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Spend by Category</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Credit card purchase spend only (expenses).</p>
          </div>
          <div className="w-full max-w-[16rem] space-y-2">
            <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Select month">
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {isCurrentMonth ? (
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={toDate}
                  onChange={(event) => setToDate(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                To date
              </label>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">{toCurrency(total)}</span>
          <span className="text-muted-foreground">for {periodLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.06)] px-3 py-2 text-sm text-[hsl(var(--destructive)/0.9)]">
            {error}
          </div>
        ) : total <= 0 || rows.length === 0 ? (
          <EmptyState
            className="min-h-[200px]"
            title="No spending in this period"
            description="Try another month to view category spending."
          />
        ) : (
          <Tabs defaultValue="donut">
            <TabsList className="mb-3 h-8">
              <TabsTrigger value="donut">Donut</TabsTrigger>
              <TabsTrigger value="bar">Bar</TabsTrigger>
            </TabsList>

            <TabsContent value="donut" className="mt-0">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutRows} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={96}>
                      {donutRows.map((_, index) => (
                        <Cell key={`donut-${index}`} fill={chartColor(index)} />
                      ))}
                    </Pie>
                    <Tooltip content={<SpendTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="bar" className="mt-0">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barRows}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={128}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <XAxis type="number" hide />
                    <Tooltip content={<SpendTooltip />} />
                    <Bar dataKey="amount" radius={[6, 6, 6, 6]}>
                      {barRows.map((_, index) => (
                        <Cell key={`bar-${index}`} fill={chartColor(index)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
