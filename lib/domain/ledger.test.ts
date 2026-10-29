import { describe, expect, it } from "vitest";
import { buildLedger } from "./ledger";
import type { Entry } from "./types";

let seq = 0;
const entry = (p: Partial<Entry>): Entry => ({
  id: `e${++seq}`, entry_type: "expense", main_category: "餐飲", sub_category: "晚餐", amount: 100, currency: "TWD",
  entry_date: "2026-10-28", notes: null, account_id: "cash", transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});

describe("buildLedger (October 2026, today = 28th)", () => {
  const entries = [
    entry({ entry_date: "2026-10-01", entry_type: "income", main_category: "薪資", sub_category: "other", amount: 58000 }),
    entry({ entry_date: "2026-10-03", amount: 100 }),
    entry({ entry_date: "2026-10-04", amount: 300 }),
    entry({ entry_date: "2026-10-04", amount: 50, currency: "JPY" }),
    entry({ entry_date: "2026-10-05", entry_type: "transfer", main_category: "轉帳", sub_category: "other", amount: 9999, transfer_account_id: "bank" }),
    entry({ entry_date: "2026-10-06", amount: 70, deleted_at: "x" }),
    entry({ entry_date: "2026-09-30", amount: 5 }),
    entry({ entry_date: "2026-11-01", amount: 6 }),
    entry({ entry_date: "2026-10-28", amount: 680 }),
  ];
  const ledger = buildLedger({ year: 2026, month: 10, entries, today: "2026-10-28" });

  const lines = ledger.weeks.flatMap((w) => w.lines);

  it("writes one line per live entry, plus today; only a day's first line carries the date", () => {
    expect(lines.map((l) => [l.day, l.first])).toEqual([[1, true], [3, true], [4, true], [4, false], [5, true], [28, true]]);
  });
  it("names each line by its main category and note, falling back to the sub-category but never 一般", () => {
    const one = buildLedger({ year: 2026, month: 10, today: "2026-10-28", entries: [
      entry({ entry_date: "2026-10-02", notes: "洗衣精", main_category: "日用購物", sub_category: null }),
      entry({ entry_date: "2026-10-02", main_category: "餐飲", sub_category: "晚餐" }),
      entry({ entry_date: "2026-10-02", main_category: "餐飲", sub_category: "other" }),
    ] }).weeks[0].lines;
    expect(one.map((l) => [l.cat, l.det])).toEqual([["日用購物", "洗衣精"], ["餐飲", "晚餐"], ["餐飲", ""]]);
  });
  it("today with no entries still gets an empty line", () => {
    const quiet = buildLedger({ year: 2026, month: 10, entries: [], today: "2026-10-28" }).weeks.flatMap((w) => w.lines);
    expect(quiet).toMatchObject([{ day: 28, entry: null, isToday: true }]);
  });
  it("transfers and other currencies never reach income or expense", () => {
    expect(ledger.income).toBe(58000);
    expect(ledger.expense).toBe(100 + 300 + 680);
    const d4 = lines.filter((l) => l.day === 4);
    expect(d4.map((l) => [l.expense, l.foreign])).toEqual([[300, false], [0, true]]);
    expect(lines.find((l) => l.day === 5)).toMatchObject({ transfer: true, cat: "轉帳", income: 0, expense: 0 });
  });
  it("neighbouring months do not leak in; week totals sum to the month", () => {
    expect(ledger.weeks.reduce((s, w) => s + w.expense, 0)).toBe(ledger.expense);
    expect(ledger.weeks.reduce((s, w) => s + w.income, 0)).toBe(ledger.income);
  });
  it("weeks end on Saturday, carry their span, and weeks with no lines are left out", () => {
    expect(ledger.weeks.map((w) => [w.start, w.end])).toEqual([[1, 3], [4, 10], [25, 31]]);
  });
  it("marks today only in the current month", () => {
    expect(lines.filter((l) => l.isToday).map((l) => l.day)).toEqual([28]);
    const other = buildLedger({ year: 2026, month: 10, entries, today: "2026-11-02" });
    expect(other.weeks.flatMap((w) => w.lines).some((l) => l.isToday)).toBe(false);
  });
  it("net is income minus expense; an empty month is all zeros with no lines", () => {
    expect(ledger.net).toBe(58000 - 1080);
    const empty = buildLedger({ year: 2026, month: 2, entries: [], today: "2026-10-28" });
    expect(empty).toMatchObject({ income: 0, expense: 0, net: 0, weeks: [] });
  });
});
