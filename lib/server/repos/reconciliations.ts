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

export interface ReconciliationWithAccount extends ReconciliationRow {
  account_id: string;
  created_at: string;
}

/** Every reconciliation of this user, newest first (for the 今日 alerts, which keep the latest per account). */
export async function listAllReconciliations(
  client: SupabaseClient,
  userId: string,
): Promise<ReconciliationWithAccount[]> {
  const { data, error } = await client
    .from("reconciliations")
    .select("account_id, statement_date, statement_balance, book_balance, diff, created_at")
    .eq("user_id", userId)
    .order("statement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<keyof ReconciliationWithAccount, number | string>[]).map((r) => ({
    account_id: String(r.account_id),
    created_at: String(r.created_at),
    statement_date: String(r.statement_date),
    statement_balance: Number(r.statement_balance),
    book_balance: Number(r.book_balance),
    diff: Number(r.diff),
  }));
}

/** diff is a generated column (book − statement); never insert it. */
export async function insertReconciliation(
  client: SupabaseClient,
  userId: string,
  row: { account_id: string; statement_date: string; statement_balance: number; book_balance: number },
): Promise<void> {
  const { error } = await client.from("reconciliations").insert({ ...row, user_id: userId });
  if (error) throw new Error(error.message);
}
