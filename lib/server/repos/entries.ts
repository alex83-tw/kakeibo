import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, EntryType } from "@/lib/domain/types";
import type { ValidEntry } from "@/lib/domain/validate";

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

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

/** Entries with entry_date in [start, end], both inclusive. Pages through every row. */
export async function listEntries(
  client: SupabaseClient,
  userId: string,
  range: { start: string; end: string },
): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await scopedEntries(client, userId)
      .gte("entry_date", range.start)
      .lte("entry_date", range.end)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as EntryRow[];
    out.push(...rows.map(toEntry));
    if (rows.length < PAGE) return out;
  }
}

const TWD = "TWD";

/** Returns the new id. user_id is written explicitly: the column default is auth.uid(), which is null for a dev bypass. */
export async function insertEntry(client: SupabaseClient, userId: string, value: ValidEntry): Promise<string> {
  const { data, error } = await client
    .from("accounting_entries")
    .insert({ ...value, user_id: userId, currency: TWD, is_recurring: false })
    .select("id");
  if (error) throw new Error(error.message);
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (!id) throw new Error("insert returned no row");
  return id;
}

/** False when no live row of this user has that id. */
export async function updateEntryRow(
  client: SupabaseClient,
  userId: string,
  id: string,
  value: ValidEntry,
): Promise<boolean> {
  const { data, error } = await client
    .from("accounting_entries")
    .update({ ...value, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}

/** Soft delete (deleted = true) or restore (false). False when this user has no such row. */
export async function setEntryDeleted(
  client: SupabaseClient,
  userId: string,
  id: string,
  deleted: boolean,
): Promise<boolean> {
  const { data, error } = await client
    .from("accounting_entries")
    .update({ deleted_at: deleted ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}
