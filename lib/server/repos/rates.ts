import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateRecord {
  currency: string;
  date: string;
  rate: number;
  source: string | null;
}

const CHUNK = 500;

/** Newest first. Only X→TWD rows: those are what kakeibo converts with. */
export async function listRateRecords(client: SupabaseClient, limit: number): Promise<RateRecord[]> {
  const { data, error } = await client
    .from("exchange_rates")
    .select("from_currency, rate, date, source")
    .eq("to_currency", "TWD")
    .order("date", { ascending: false })
    .order("from_currency", { ascending: true })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { from_currency: string; rate: number | string; date: string; source: string | null }[]).map((r) => ({
    currency: r.from_currency,
    date: r.date.slice(0, 10),
    rate: Number(r.rate),
    source: r.source,
  }));
}

type RateRow = { from_currency: string; to_currency: string; rate: number; date: string; source: string };

/** Insert or replace by (from, to, date). */
export async function upsertRates(client: SupabaseClient, rows: RateRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await client.from("exchange_rates").upsert(rows.slice(i, i + CHUNK), { onConflict: "from_currency,to_currency,date" });
    if (error) throw new Error(error.message);
  }
}

/** Remove both directions of one day. False when there was no X→TWD row. */
export async function deleteRateDay(client: SupabaseClient, currency: string, date: string): Promise<boolean> {
  const { data, error } = await client.from("exchange_rates").delete().eq("from_currency", currency).eq("to_currency", "TWD").eq("date", date).select("date");
  if (error) throw new Error(error.message);
  const { error: e2 } = await client.from("exchange_rates").delete().eq("from_currency", "TWD").eq("to_currency", currency).eq("date", date);
  if (e2) throw new Error(e2.message);
  return (data ?? []).length > 0;
}
