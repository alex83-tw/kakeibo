import { describe, expect, it } from "vitest";
import { rateOn, toTwd, type RateRow } from "./fx";
import type { Entry } from "./types";

const rates: RateRow[] = [
  { currency: "JPY", date: "2026-10-01", rate: 0.2 },
  { currency: "JPY", date: "2026-10-10", rate: 0.25 },
  { currency: "USD", date: "2026-10-01", rate: 31 },
];
const entry = (over: Partial<Entry>): Entry => ({
  id: "e", entry_type: "expense", main_category: "餐飲", sub_category: null, amount: 1000, currency: "JPY",
  entry_date: "2026-10-12", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...over,
});

describe("rateOn", () => {
  it("uses the row on the day", () => expect(rateOn(rates, "JPY", "2026-10-10")).toBe(0.25));
  it("uses the latest row before the day", () => expect(rateOn(rates, "JPY", "2026-10-09")).toBe(0.2));
  it("uses the earliest row after when none is before", () => expect(rateOn(rates, "JPY", "2026-09-01")).toBe(0.2));
  it("falls back to a constant when the currency has no rows", () => expect(rateOn([], "USD", "2026-10-01")).toBe(32));
  it("is 1 for TWD and null for a currency it knows nothing about", () => {
    expect(rateOn([], "TWD", "2026-10-01")).toBe(1);
    expect(rateOn([], "EUR", "2026-10-01")).toBeNull();
  });
});

describe("toTwd", () => {
  it("converts at the entry-date rate, rounds, and keeps what is stored", () => {
    expect(toTwd(entry({ amount: 1234 }), rates)).toMatchObject({
      amount: 309, // 1234 × 0.25 = 308.5
      currency: "TWD",
      foreign: { currency: "JPY", amount: 1234, rate: 0.25 },
    });
  });
  it("leaves TWD and unknown currencies as they are", () => {
    const twd = entry({ currency: "TWD" });
    expect(toTwd(twd, rates)).toBe(twd);
    const eur = entry({ currency: "EUR" });
    expect(toTwd(eur, rates)).toBe(eur);
  });
});
