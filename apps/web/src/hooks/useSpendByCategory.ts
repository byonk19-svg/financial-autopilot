import { useEffect, useMemo, useRef, useState } from "react";
import { captureException } from "@/lib/errorReporting";
import { toNumber } from "@/lib/subscriptionFormatters";
import { supabase } from "@/lib/supabase";
import type { CategorySpendRow } from "@/lib/categoryChart";

type SpendByCategoryRpcRow = {
  category: string | null;
  amount: number | string | null;
};

type UseSpendByCategoryResult = {
  rows: CategorySpendRow[];
  loading: boolean;
  error: string;
  total: number;
};

export function useSpendByCategory(startDate: string, endDate: string): UseSpendByCategoryResult {
  const [rows, setRows] = useState<CategorySpendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError("");

    const load = async () => {
      const { data, error: rpcError } = await supabase.rpc("spend_by_category", {
        start_date: startDate,
        end_date: endDate,
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (rpcError) {
        captureException(rpcError, {
          component: "useSpendByCategory",
          action: "spend-by-category-rpc",
          startDate,
          endDate,
        });
        setRows([]);
        setError(rpcError.message || "Could not load category spending.");
        setLoading(false);
        return;
      }

      const normalized = ((data ?? []) as SpendByCategoryRpcRow[])
        .map((row) => ({
          category: row.category?.trim() || "Uncategorized",
          amount: toNumber(row.amount),
        }))
        .filter((row) => row.amount > 0);

      setRows(normalized);
      setLoading(false);
    };

    void load();
  }, [startDate, endDate]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);

  return { rows, loading, error, total };
}
