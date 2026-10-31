"use server";

import { revalidatePath } from "next/cache";
import { RATE_CURRENCIES, rateRows, validateRateInput, type RateInput } from "@/lib/domain/rates";
import { getUserId } from "@/lib/server/auth";
import { deleteRateDay, upsertRates } from "@/lib/server/repos/rates";
import { createServerClient } from "@/lib/server/supabase";
import { fetchDailyRates } from "@/lib/server/yahoo-fx";
import { twToday } from "@/lib/time";

export type RateResult = { ok: true; message?: string } | { ok: false; errors: Partial<Record<keyof RateInput | "form", string>> };

const MAX_DAYS = 400; // not exported: a "use server" file may only export async functions

async function guarded(run: (client: Awaited<ReturnType<typeof createServerClient>>) => Promise<RateResult>): Promise<RateResult> {
  try {
    await getUserId(); // exchange_rates is shared by everyone, so only the sign-in is checked
    const res = await run(await createServerClient());
    if (res.ok) revalidatePath("/", "layout"); // every page converts foreign entries with these
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, errors: { form: "請先登入" } };
    return { ok: false, errors: { form: "處理失敗，請稍後再試" } };
  }
}

/** One manual rate for one day, both directions. */
export async function saveRate(input: RateInput): Promise<RateResult> {
  const v = validateRateInput(input, twToday());
  if (!v.ok) return { ok: false, errors: v.errors };
  return guarded(async (client) => {
    await upsertRates(client, rateRows(v.value, "manual"));
    return { ok: true };
  });
}

export async function removeRate(currency: string, date: string): Promise<RateResult> {
  if (!(RATE_CURRENCIES as readonly string[]).includes(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, errors: { form: "資料不正確" } };
  return guarded(async (client) => ((await deleteRateDay(client, currency, date)) ? { ok: true, message: "已刪除" } : { ok: false, errors: { form: "找不到這筆匯率" } }));
}

/** Pull the last `days` days of USD and JPY from Yahoo. Re-running is safe: rows are replaced by (from, to, date). */
export async function syncRates(days: number): Promise<RateResult> {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { ok: false, errors: { form: "天數不正確" } };
  return guarded(async (client) => {
    const end = twToday();
    const start = new Date(Date.parse(`${end}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
    const got = await Promise.allSettled(RATE_CURRENCIES.map((c) => fetchDailyRates(c, start, end)));
    const rows = got.flatMap((g, i) => (g.status === "fulfilled" ? g.value.flatMap(({ date, close }) => rateRows({ currency: RATE_CURRENCIES[i], date, rate: Math.round(close * 1e6) / 1e6 }, "yahoo-finance")) : []));
    const failed = RATE_CURRENCIES.filter((_, i) => got[i].status === "rejected");
    if (rows.length === 0) return { ok: false, errors: { form: failed.length > 0 ? "連不上 Yahoo Finance，請稍後再試，或手動輸入" : "這段期間沒有取得匯率" } };
    await upsertRates(client, rows);
    const count = rows.length / 2;
    return { ok: true, message: `已更新 ${count} 筆${failed.length > 0 ? `（${failed.join("、")} 失敗）` : ""}` };
  });
}
