import { useEffect, useMemo, useRef, useState } from "react";
import { endOfMonth, format, isSameMonth, parseISO, startOfMonth, subMonths } from "date-fns";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { captureException } from "@/lib/errorReporting";
import { toCurrency } from "@/lib/subscriptionFormatters";
import { supabase } from "@/lib/supabase";
import { useSpendByCategory } from "@/hooks/useSpendByCategory";
import { buildBarCategoryRows, buildDonutCategoryRows, type CategorySpendRow } from "@/lib/categoryChart";

const CHART_COLOR_TOKENS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const;
const MONTH_OPTIONS_COUNT = 18;

type MonthOption = {
  value: string;
  label: string;
  monthStart: Date;
};

function chartColor(index: number): string {
  return `hsl(var(${CHART_COLOR_TOKENS[index % CHART_COLOR_TOKENS.length]}))`;
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

// ─── Category Drill-Down Hook ─────────────────────────────────────────────────

type DrillDownRow = {
  id: string;
  posted_at: string;
  amount: number;
  merchant: string;
};

function useCategoryDrillDown(categoryName: string | null, startDate: string, endDate: string) {
  const [rows, setRows] = useState<DrillDownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!categoryName) {
      setRows([]);
      return;
    }

    const reqId = ++reqRef.current;
    setLoading(true);

    const run = async () => {
      try {
        let categoryIds: string[] = [];

        if (categoryName !== "Uncategorized") {
          const { data: cats } = await supabase
            .from("categories")
            .select("id")
            .eq("name", categoryName);
          categoryIds = (cats ?? []).map((c: { id: string }) => c.id);
          if (categoryIds.length === 0) {
            if (reqRef.current === reqId) { setRows([]); setLoading(false); }
            return;
          }
        }

        let query = supabase
          .from("transactions")
          .select("id, posted_at, amount, merchant_canonical, merchant_normalized, description_short")
          .eq("is_deleted", false)
          .eq("is_pending", false)
          .eq("is_hidden", false)
          .eq("type", "expense")
          .eq("is_credit", true)
          .gte("posted_at", `${startDate}T00:00:00.000Z`)
          .lte("posted_at", `${endDate}T23:59:59.999Z`)
          .order("posted_at", { ascending: false })
          .limit(50);

        if (categoryName === "Uncategorized") {
          query = query.is("user_category_id", null).is("category_id", null) as typeof query;
        } else {
          const orParts = categoryIds.flatMap((id) => [
            `user_category_id.eq.${id}`,
            `and(user_category_id.is.null,category_id.eq.${id})`,
          ]);
          query = query.or(orParts.join(",")) as typeof query;
        }

        const { data, error } = await query;
        if (reqRef.current !== reqId) return;

        if (error) {
          captureException(error, { component: "useCategoryDrillDown", categoryName });
          setRows([]);
        } else {
          setRows(
            (data ?? []).map((row: {
              id: string;
              posted_at: string;
              amount: number | string;
              merchant_canonical: string | null;
              merchant_normalized: string | null;
              description_short: string | null;
            }) => ({
              id: row.id,
              posted_at: row.posted_at,
              amount: Math.abs(Number(row.amount)),
              merchant: row.merchant_canonical || row.merchant_normalized || row.description_short || "Transaction",
            })),
          );
        }
      } catch (err) {
        if (reqRef.current !== reqId) return;
        captureException(err, { component: "useCategoryDrillDown", categoryName });
        setRows([]);
      } finally {
        if (reqRef.current === reqId) setLoading(false);
      }
    };

    void run();
  }, [categoryName, startDate, endDate]);

  return { rows, loading };
}

// ─── Category Drill-Down Panel ────────────────────────────────────────────────

function CategoryDrillDown({
  categoryName,
  startDate,
  endDate,
  onClose,
}: {
  categoryName: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const { rows, loading } = useCategoryDrillDown(categoryName, startDate, endDate);

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <span className="text-xs font-semibold text-foreground">{categoryName}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close drill-down"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">No transactions found.</p>
      ) : (
        <ul className="max-h-64 divide-y divide-border/30 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate text-foreground" title={row.merchant}>
                {row.merchant}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {format(parseISO(row.posted_at), "MMM d")}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-foreground">
                {toCurrency(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!loading && rows.length > 0 && (
        <div className="border-t border-border/40 px-3 py-1.5 text-right">
          <span className="text-xs text-muted-foreground">{rows.length} transaction{rows.length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

// ─── SVG Donut Chart ────────────────────────────────────────────────────────

const CX = 100;
const CY = 100;
const INNER_R = 50;
const OUTER_R = 80;
const SLICE_GAP_DEG = 2;

type SlicePath = {
  path: string;
  color: string;
  row: CategorySpendRow;
  index: number;
};

function buildSlices(rows: CategorySpendRow[], total: number): SlicePath[] {
  if (total <= 0) return [];
  let startAngle = -90;
  return rows.map((row, index) => {
    const pct = row.amount / total;
    const sweep = pct * 360 - SLICE_GAP_DEG;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > 180 ? 1 : 0;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = CX + OUTER_R * Math.cos(toRad(startAngle));
    const y1 = CY + OUTER_R * Math.sin(toRad(startAngle));
    const x2 = CX + OUTER_R * Math.cos(toRad(endAngle));
    const y2 = CY + OUTER_R * Math.sin(toRad(endAngle));
    const x3 = CX + INNER_R * Math.cos(toRad(endAngle));
    const y3 = CY + INNER_R * Math.sin(toRad(endAngle));
    const x4 = CX + INNER_R * Math.cos(toRad(startAngle));
    const y4 = CY + INNER_R * Math.sin(toRad(startAngle));
    const path = `M ${x1} ${y1} A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    startAngle += pct * 360;
    return { path, color: chartColor(index), row, index };
  });
}

function DonutChart({
  rows,
  total,
  selectedCategory,
  onSelectCategory,
}: {
  rows: CategorySpendRow[];
  total: number;
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const slices = useMemo(() => buildSlices(rows, total), [rows, total]);

  const effectiveIndex = hovered !== null ? hovered : (selectedCategory ? rows.findIndex((r) => r.category === selectedCategory) : null);
  const activeRow = effectiveIndex !== null && effectiveIndex >= 0 ? rows[effectiveIndex] : null;
  const centerAmount = activeRow ? activeRow.amount : total;
  const centerLabel = activeRow ? activeRow.category : "total";

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      {/* SVG donut */}
      <div className="shrink-0">
        <svg
          viewBox="0 0 200 200"
          width="168"
          height="168"
          role="img"
          aria-label="Spend by category donut chart"
        >
          <title>Spend by category</title>
          {slices.map(({ path, color, row, index }) => {
            const isSelected = selectedCategory === row.category;
            const dimmed = selectedCategory !== null ? !isSelected : (hovered !== null && hovered !== index);
            return (
              <path
                key={index}
                d={path}
                fill={color}
                style={{
                  opacity: dimmed ? 0.35 : 1,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                  strokeWidth: isSelected ? 2.5 : 0,
                  stroke: isSelected ? "hsl(var(--background))" : "none",
                }}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectCategory(isSelected ? null : row.category)}
              />
            );
          })}
          {/* Center label */}
          <text
            x={CX}
            y={CY - 7}
            textAnchor="middle"
            fill="hsl(var(--foreground))"
            fontSize="13"
            fontWeight="600"
          >
            {toCurrency(centerAmount)}
          </text>
          <text
            x={CX}
            y={CY + 9}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize="9"
          >
            {centerLabel.length > 14 ? centerLabel.slice(0, 13) + "…" : centerLabel}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <ul className="min-w-0 flex-1 space-y-1.5" aria-label="Category legend">
        {rows.map((row, index) => {
          const isSelected = selectedCategory === row.category;
          const isHovered = hovered === index;
          const isActive = isHovered || isSelected;
          const pct = ((row.amount / total) * 100).toFixed(1);
          return (
            <li
              key={row.category}
              className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors ${isSelected ? "bg-muted/60" : "hover:bg-muted/40"}`}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectCategory(isSelected ? null : row.category)}
              aria-pressed={isSelected}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: chartColor(index) }}
                aria-hidden="true"
              />
              <span
                className={`min-w-0 flex-1 truncate transition-colors ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {row.category}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">{toCurrency(row.amount)}</span>
              <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── CSS Horizontal Bar Chart ────────────────────────────────────────────────

function HorizontalBarChart({
  rows,
  selectedCategory,
  onSelectCategory,
}: {
  rows: CategorySpendRow[];
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
}) {
  const max = rows[0]?.amount ?? 1;
  return (
    <ul className="space-y-3" role="list" aria-label="Spend by category bar chart">
      {rows.map((row, index) => {
        const widthPct = (row.amount / max) * 100;
        const isSelected = selectedCategory === row.category;
        return (
          <li
            key={row.category}
            className={`cursor-pointer rounded px-1 transition-colors ${isSelected ? "bg-muted/60" : "hover:bg-muted/40"}`}
            onClick={() => onSelectCategory(isSelected ? null : row.category)}
            aria-pressed={isSelected}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2 pt-1 text-xs">
              <span className={`truncate ${isSelected ? "font-semibold text-foreground" : "text-foreground"}`}>{row.category}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{toCurrency(row.amount)}</span>
            </div>
            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: chartColor(index) }}
                role="progressbar"
                aria-valuenow={Math.round(widthPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={row.category}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Main Card ───────────────────────────────────────────────────────────────

export function DashboardSpendByCategoryCard() {
  const now = new Date();
  const monthOptions = useMemo(() => buildMonthOptions(new Date()), []);
  const currentMonthValue = monthOptions[0].value;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [toDate, setToDate] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const selectedMonthStart = useMemo(() => startOfMonth(parseMonthValue(selectedMonth)), [selectedMonth]);
  const isCurrentMonth = isSameMonth(selectedMonthStart, now);
  const effectiveToDate = isCurrentMonth ? toDate : false;
  const selectedMonthEnd = effectiveToDate ? now : endOfMonth(selectedMonthStart);

  useEffect(() => {
    if (isCurrentMonth) {
      setToDate(true);
    }
  }, [isCurrentMonth, selectedMonth]);

  // Reset drill-down when month changes
  useEffect(() => {
    setSelectedCategory(null);
  }, [selectedMonth]);

  const startDate = format(selectedMonthStart, "yyyy-MM-dd");
  const endDate = format(selectedMonthEnd, "yyyy-MM-dd");
  const { rows, loading, error, total } = useSpendByCategory(startDate, endDate);

  const donutRows = useMemo(() => buildDonutCategoryRows(rows), [rows]);
  const barRows = useMemo(() => buildBarCategoryRows(rows), [rows]);
  const periodLabel = effectiveToDate
    ? `${format(selectedMonthStart, "MMM d")} – ${format(selectedMonthEnd, "MMM d, yyyy")}`
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
            <Skeleton className="h-52 w-full" />
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
            <TabsList className="mb-4 h-8">
              <TabsTrigger value="donut">Donut</TabsTrigger>
              <TabsTrigger value="bar">Bar</TabsTrigger>
            </TabsList>
            <TabsContent value="donut" className="mt-0">
              <DonutChart
                rows={donutRows}
                total={total}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </TabsContent>
            <TabsContent value="bar" className="mt-0">
              <HorizontalBarChart
                rows={barRows}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </TabsContent>
            {selectedCategory && (
              <CategoryDrillDown
                categoryName={selectedCategory}
                startDate={startDate}
                endDate={endDate}
                onClose={() => setSelectedCategory(null)}
              />
            )}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
