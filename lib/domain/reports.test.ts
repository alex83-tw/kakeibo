import { describe, expect, it } from "vitest";
import { categoryBreakdown, change, dailyExpense, heatLevel, monthlyTotals, periodRange, previousPeriod, readRange, totals, trendMonths } from "./reports";
import type { Entry } from "./types";

const e = (entry_date: string, entry_type: Entry["entry_type"], amount: number, main_category = "餐飲"): Entry => ({
  id: `${entry_date}${amount}${main_category}`, entry_type, main_category, sub_category: "other", amount, currency: "TWD", entry_date, notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false,
});

const rows = [
  e("2026-09-30", "expense", 100),
  e("2026-10-01", "income", 5000, "薪資"),
  e("2026-10-02", "expense", 300),
  e("2026-10-02", "expense", 200, "交通"),
  e("2026-10-31", "expense", 500, "交通"),
  e("2026-10-15", "transfer", 9999, "轉帳"),
  e("2026-11-01", "expense", 70),
];

describe("periods", () => {
  it("month and year ranges, and what each is compared with", () => {
    expect(periodRange({ kind: "month", year: 2026, month: 2 })).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodRange({ kind: "year", year: 2026 })).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(previousPeriod({ kind: "month", year: 2026, month: 1 })).toEqual({ kind: "month", year: 2025, month: 12 });
    expect(previousPeriod({ kind: "year", year: 2026 })).toEqual({ kind: "year", year: 2025 });
  });
  it("the month trend is the six months ending at the viewed one; the year trend is Jan–Dec", () => {
    expect(trendMonths({ kind: "month", year: 2026, month: 2 })).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(trendMonths({ kind: "year", year: 2026 })).toHaveLength(12);
  });
  it("one read covers the period, the previous one and the trend", () => {
    expect(readRange({ kind: "month", year: 2026, month: 10 })).toEqual({ start: "2026-05-01", end: "2026-10-31" });
    expect(readRange({ kind: "year", year: 2026 })).toEqual({ start: "2025-01-01", end: "2026-12-31" });
  });
});

describe("totals", () => {
  it("counts income and expense inside the range and leaves transfers out", () => {
    expect(totals(rows, { start: "2026-10-01", end: "2026-10-31" })).toEqual({ income: 5000, expense: 1000, net: 4000 });
  });
});

describe("monthlyTotals", () => {
  it("one row per month asked for, zeros when empty", () => {
    expect(monthlyTotals(rows, ["2026-08", "2026-09", "2026-10"])).toEqual([
      { month: "2026-08", income: 0, expense: 0 },
      { month: "2026-09", income: 0, expense: 100 },
      { month: "2026-10", income: 5000, expense: 1000 },
    ]);
  });
});

describe("categoryBreakdown", () => {
  it("biggest first with whole-percent shares and the previous period's amount", () => {
    const r = categoryBreakdown(rows, { start: "2026-10-01", end: "2026-10-31" }, { start: "2026-09-01", end: "2026-09-30" });
    expect(r).toEqual([
      { main: "交通", amount: 700, share: 70, prev: 0 },
      { main: "餐飲", amount: 300, share: 30, prev: 100 },
    ]);
  });
  it("is empty with no spending", () => {
    expect(categoryBreakdown([], { start: "2026-10-01", end: "2026-10-31" }, { start: "2026-09-01", end: "2026-09-30" })).toEqual([]);
  });
});

describe("dailyExpense / heatLevel / change", () => {
  it("one slot per day of the month", () => {
    const d = dailyExpense(rows, 2026, 10);
    expect(d).toHaveLength(31);
    expect(d[1]).toBe(500);
    expect(d[30]).toBe(500);
    expect(d[0]).toBe(0);
  });
  it("shades by share of the heaviest day", () => {
    expect([0, 1, 125, 250, 251, 500].map((a) => heatLevel(a, 500))).toEqual([0, 1, 1, 2, 3, 4]);
    expect(heatLevel(5, 0)).toBe(0);
  });
  it("change is null without a base", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(10, 0)).toBeNull();
  });
});
