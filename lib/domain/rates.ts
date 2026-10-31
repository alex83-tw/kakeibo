import { isRealDate } from "@/lib/time";

/** Currencies kakeibo converts to TWD. */
export const RATE_CURRENCIES = ["USD", "JPY"] as const;

export interface RateInput {
  currency: string;
  date: string;
  rate: string;
}

export interface ValidRate {
  currency: string;
  date: string;
  rate: number;
}

export type RateValidation = { ok: true; value: ValidRate } | { ok: false; errors: Partial<Record<keyof RateInput, string>> };

/** `today` is injected so a rate cannot be dated in the future (rateOn would then apply it to real entries). */
export function validateRateInput(i: RateInput, today: string): RateValidation {
  const errors: Partial<Record<keyof RateInput, string>> = {};
  if (!(RATE_CURRENCIES as readonly string[]).includes(i.currency)) errors.currency = "請選擇幣別";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date) || !isRealDate(i.date)) errors.date = "請輸入日期";
  else if (i.date > today) errors.date = "不能是未來的日期";
  const s = i.rate.replace(/,/g, "").trim();
  const rate = Number(s);
  if (s === "" || !Number.isFinite(rate)) errors.rate = "請輸入匯率";
  else if (rate <= 0 || rate > 1000) errors.rate = "匯率要大於 0、小於 1000";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { currency: i.currency, date: i.date, rate: Math.round(rate * 1e6) / 1e6 } };
}

/** The rows exchange_rates keeps for one day: X→TWD (what kakeibo reads) and TWD→X (what financial-advisor reads). USD↔JPY is left to advisor's own sync. */
export function rateRows(v: ValidRate, source: string) {
  return [
    { from_currency: v.currency, to_currency: "TWD", rate: v.rate, date: v.date, source },
    { from_currency: "TWD", to_currency: v.currency, rate: Math.round((1 / v.rate) * 1e8) / 1e8, date: v.date, source },
  ];
}

/** Daily closes out of a Yahoo v8 chart response. Days without a close (holidays) are skipped; anything unexpected gives []. */
export function parseYahooChart(json: unknown): { date: string; close: number }[] {
  const r = (json as { chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] } })?.chart?.result?.[0];
  const ts = r?.timestamp;
  const close = r?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) return [];
  const out = new Map<string, number>();
  ts.forEach((t, i) => {
    const c = close[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) out.set(new Date(t * 1000).toISOString().slice(0, 10), c);
  });
  return [...out].map(([date, close]) => ({ date, close }));
}

/** Days from `date` to `today`, for the "last updated N days ago" hint. */
export function daysBetween(date: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}
