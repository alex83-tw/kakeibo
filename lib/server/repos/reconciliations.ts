import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReconciliationRow {
  statement_date: string;
  statement_balance: number;
  book_balance: number;
  diff: number;
}

export async function listReconciliations(
  client: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<ReconciliationRow[]> {
  const { data, error } = await client
    .from("reconciliations")
    .select("statement_date, statement_balance, book_balance, diff")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("statement_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<keyof ReconciliationRow, number | string>[]).map((r) => ({
    statement_date: String(r.statement_date),
    statement_balance: Number(r.statement_balance),
    book_balance: Number(r.book_balance),
    diff: Number(r.diff),
  }));
}
