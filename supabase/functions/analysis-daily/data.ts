import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import type { TxRow } from "./types.ts";

export async function listUserIdsWithAccounts(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await admin.from("accounts").select("user_id");
  if (error) throw new Error("Could not resolve users with accounts.");
  return [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))];
}

export async function fetchTransactions(
  admin: ReturnType<typeof createClient>,
  userId: string,
  since: Date,
): Promise<TxRow[]> {
  const { data, error } = await admin
    .from("transactions")
    .select(
      "id, account_id, posted_at, amount, merchant_canonical, merchant_normalized, description_short, category_id, user_category_id",
    )
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .gte("posted_at", since.toISOString())
    .order("posted_at", { ascending: true });

  if (error) throw new Error("Could not read transactions.");
  return (data ?? []) as TxRow[];
}

export async function fetchCategoryNames(
  admin: ReturnType<typeof createClient>,
  userId: string,
  txRows: TxRow[],
): Promise<Map<string, string>> {
  const ids = [...new Set(txRows.flatMap((row) => [row.user_category_id, row.category_id]).filter(Boolean))];
  if (ids.length === 0) return new Map<string, string>();

  const { data, error } = await admin
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", ids as string[]);

  if (error) throw new Error("Could not read categories.");

  const names = new Map<string, string>();
  for (const row of data ?? []) {
    names.set(row.id, row.name);
  }
  return names;
}
