import type { SupabaseClient } from "@supabase/supabase-js";
import { rateOn, toTwd, type RateRow } from "@/lib/domain/fx";
import { SEARCH_CAP, type SearchFilters, sqlFilter } from "@/lib/domain/search";
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

const RATE_LOOKBACK_DAYS = 31;

/** exchange_rates rows to TWD for these currencies, from a month before `start` through `end` (a rate is the latest row on or before the entry date). */
async function listRates(client: SupabaseClient, currencies: string[], range: { start: string; end: string }): Promise<RateRow[]> {
  const from = new Date(`${range.start}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - RATE_LOOKBACK_DAYS);
  const out: RateRow[] = [];
  for (let at = 0; ; at += PAGE) {
    const { data, error } = await client
      .from("exchange_rates")
      .select("from_currency, rate, date")
      .eq("to_currency", "TWD")
      .in("from_currency", currencies)
      .gte("date", from.toISOString().slice(0, 10))
      .lte("date", range.end)
      .order("date", { ascending: true })
      .range(at, at + PAGE - 1);
    if (error) {
      // ponytail: rates are advisory; without them toTwd uses the fallback constants instead of taking every page down.
      console.error("exchange_rates", error.message);
      return [];
    }
    const rows = (data ?? []) as { from_currency: string; rate: number | string; date: string }[];
    out.push(...rows.map((r) => ({ currency: r.from_currency, date: r.date.slice(0, 10), rate: Number(r.rate) })));
    if (rows.length < PAGE) return out;
  }
}

/** The TWD per 1 unit of `currency` on `date`, for the form's ≈ preview. Null for a currency we know nothing about. */
export async function rateFor(client: SupabaseClient, currency: string, date: string): Promise<number | null> {
  return rateOn(await listRates(client, [currency], { start: date, end: date }), currency, date);
}

/** Entries with entry_date in [start, end], both inclusive. Pages through every row. Foreign-currency entries come back converted to TWD (see toTwd). */
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
    if (rows.length < PAGE) break;
  }
  const foreign = [...new Set(out.filter((e) => e.currency !== "TWD").map((e) => e.currency))];
  if (foreign.length === 0) return out;
  const rates = await listRates(client, foreign, range);
  return out.map((e) => toTwd(e, rates));
}

/**
 * Entries matching the database-side part of a search (type, main category, date range), newest first, at most SEARCH_CAP of them
 * (`truncated` says there were more). Foreign rows come back converted like listEntries; amount and text filters are applied by the caller.
 */
export async function searchEntries(client: SupabaseClient, userId: string, f: SearchFilters): Promise<{ entries: Entry[]; truncated: boolean }> {
  const sql = sqlFilter(f);
  const rows: EntryRow[] = [];
  for (let from = 0; from <= SEARCH_CAP; from += PAGE) {
    let q = scopedEntries(client, userId);
    if (sql.type) q = q.eq("entry_type", sql.type);
    if (sql.main) q = q.eq("main_category", sql.main);
    if (sql.from) q = q.gte("entry_date", sql.from);
    if (sql.to) q = q.lte("entry_date", sql.to);
    // one row past the cap tells us there is more
    const { data, error } = await q
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, Math.min(from + PAGE - 1, SEARCH_CAP));
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as EntryRow[];
    rows.push(...page);
    if (page.length < Math.min(PAGE, SEARCH_CAP + 1 - from)) break;
  }
  const truncated = rows.length > SEARCH_CAP;
  const entries = rows.slice(0, SEARCH_CAP).map(toEntry);
  const foreign = [...new Set(entries.filter((e) => e.currency !== "TWD").map((e) => e.currency))];
  if (foreign.length === 0) return { entries, truncated };
  const dates = entries.map((e) => e.entry_date).sort();
  const rates = await listRates(client, foreign, { start: dates[0], end: dates[dates.length - 1] });
  return { entries: entries.map((e) => toTwd(e, rates)), truncated };
}

/** The newest `n` entries (oldest-first, like listEntries), unconverted: enough to learn which categories are in use without paging the whole year or touching exchange_rates. */
export async function listRecentEntries(client: SupabaseClient, userId: string, n = 300): Promise<Entry[]> {
  const { data, error } = await scopedEntries(client, userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, n - 1);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as EntryRow[]).map(toEntry).reverse();
}

/** Returns the new id. user_id is written explicitly: the column default is auth.uid(), which is null for a dev bypass. */
export async function insertEntry(client: SupabaseClient, userId: string, value: ValidEntry): Promise<string> {
  const { data, error } = await client
    .from("accounting_entries")
    .insert({ ...value, user_id: userId, is_recurring: false })
    .select("id");
  if (error) throw new Error(error.message);
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (!id) throw new Error("insert returned no row");
  return id;
}

const CHUNK = 500;

/** Bulk insert (CSV import, card paste); same stamping as insertEntry. Returns the new ids, in insert order, so the caller can offer 復原. */
export async function insertEntries(client: SupabaseClient, userId: string, values: ValidEntry[]): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < values.length; i += CHUNK) {
    const rows = values.slice(i, i + CHUNK).map((v) => ({ ...v, user_id: userId, is_recurring: false }));
    const { data, error } = await client.from("accounting_entries").insert(rows).select("id");
    if (error) throw new Error(error.message);
    ids.push(...((data as { id: string }[] | null) ?? []).map((r) => r.id));
  }
  return ids;
}

const DELETE_CHUNK = 200; // ids go in the URL of an .in() filter

/**
 * Soft delete (deleted = true) or restore (false) many rows of this user. Returns the ids actually changed:
 * a delete skips rows already deleted, so undoing with the result restores exactly what this call removed.
 */
export async function setEntriesDeleted(client: SupabaseClient, userId: string, ids: string[], deleted: boolean): Promise<string[]> {
  const changed: string[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    let q = client
      .from("accounting_entries")
      .update({ deleted_at: deleted ? now : null, updated_at: now })
      .eq("user_id", userId)
      .in("id", ids.slice(i, i + DELETE_CHUNK));
    if (deleted) q = q.is("deleted_at", null);
    const { data, error } = await q.select("id");
    if (error) throw new Error(error.message);
    changed.push(...((data as { id: string }[] | null) ?? []).map((r) => r.id));
  }
  return changed;
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
