import { parseYahooChart } from "@/lib/domain/rates";

const TIMEOUT_MS = 10_000;

/** Daily closes of `<currency>TWD=X` for [start, end] (YYYY-MM-DD). Unofficial endpoint: throws on any failure so the caller can say so. */
export async function fetchDailyRates(currency: string, start: string, end: string): Promise<{ date: string; close: number }[]> {
  const p1 = Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000);
  const p2 = Math.floor(Date.parse(`${end}T00:00:00Z`) / 1000) + 86_400; // period2 is exclusive
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${currency}TWD=X?period1=${p1}&period2=${p2}&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  return parseYahooChart(await res.json());
}
