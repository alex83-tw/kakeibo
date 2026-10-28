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

export async function insertAccount(
  client: SupabaseClient,
  userId: string,
  a: { kind: AccountKind; name: string; opening_balance: number; opening_date: string },
): Promise<string> {
  const existing = await listAccounts(client, userId);
  const sort_order = existing.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1;
  const { data, error } = await client
    .from("ledger_accounts")
    .insert({ ...a, user_id: userId, sort_order })
    .select("id");
  if (error) throw new Error(error.message);
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (!id) throw new Error("insert returned no row");
  return id;
}

/** Accounts are archived, never deleted: entries and reconciliations still point at them. */
export async function setAccountArchived(client: SupabaseClient, userId: string, id: string, archived: boolean): Promise<boolean> {
  const { data, error } = await client
    .from("ledger_accounts")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}
