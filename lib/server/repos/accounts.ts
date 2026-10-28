import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountKind, LedgerAccount } from "@/lib/domain/types";

interface AccountRow {
  id: string;
  kind: AccountKind;
  name: string;
  opening_balance: number | string;
  opening_date: string;
  sort_order: number;
  archived: boolean;
}

export async function listAccounts(client: SupabaseClient, userId: string): Promise<LedgerAccount[]> {
  const { data, error } = await client
    .from("ledger_accounts")
    .select("id, kind, name, opening_balance, opening_date, sort_order, archived")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AccountRow[]).map((a) => ({ ...a, opening_balance: Number(a.opening_balance) }));
}
