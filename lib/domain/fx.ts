import type { Entry } from "./types";

export const CURRENCIES = ["TWD", "USD", "JPY"] as const;

// ponytail: stale constants, used only when exchange_rates has no row for the currency. Same values as financial-advisor.
const FALLBACK_RATES: Record<string, number> = { USD: 32, JPY: 0.22 };

/** One row of exchange_rates, `to_currency` = TWD. */
export interface RateRow {
  currency: string;
  /** YYYY-MM-DD */
  date: string;
  rate: number;
}

/** TWD per 1 unit of `currency` on `date`: the latest row on or before it, else the earliest after it, else the fallback. Null for a currency we know nothing about. */
export function rateOn(rates: RateRow[], currency: string, date: string): number | null {
  if (currency === "TWD") return 1;
  const own = rates.filter((r) => r.currency === currency);
  const before = own.filter((r) => r.date <= date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const after = own.filter((r) => r.date > date).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return (before ?? after)?.rate ?? FALLBACK_RATES[currency] ?? null;
}

/** A foreign entry as TWD, keeping what is stored in `foreign`. TWD entries and unknown currencies pass through. */
export function toTwd(e: Entry, rates: RateRow[]): Entry {
  if (e.currency === "TWD") return e;
  const rate = rateOn(rates, e.currency, e.entry_date);
  if (rate === null) return e;
  return { ...e, amount: Math.round(e.amount * rate), currency: "TWD", foreign: { currency: e.currency, amount: e.amount, rate } };
}
