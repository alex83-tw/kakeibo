import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, EntryType } from "@/lib/domain/types";

const COLUMNS =
  "id, entry_type, main_category, sub_category, amount, currency, entry_date, notes, account_id, transfer_account_id, deleted_at, is_recurring";

/** Every read of accounting_entries goes through here: this user's rows, not soft-deleted. */
export function scopedEntries(client: SupabaseClient, userId: string) {
  return client.from("accounting_entries").select(COLUMNS).eq("user_id", userId).is("deleted_at", null);
}

interface EntryRow {
  id: string;
  entry_type: EntryType;
  main_category: string;
  sub_category: string | null;
  amount: number | string;
  currency: string;
  entry_date: string;
  notes: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  deleted_at: string | null;
  is_recurring: boolean | null;
}

export function toEntry(r: EntryRow): Entry {
  return { ...r, amount: Number(r.amount), is_recurring: r.is_recurring ?? false };
}

/** Entries with entry_date in [start, end], both inclusive. */
export async function listEntries(
  client: SupabaseClient,
  userId: string,
  range: { start: string; end: string },
): Promise<Entry[]> {
  const { data, error } = await scopedEntries(client, userId)
    .gte("entry_date", range.start)
    .lte("entry_date", range.end)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
}
