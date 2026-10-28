import { describe, expect, it } from "vitest";
import { buildLedger, daySummary } from "./ledger";
import type { Entry } from "./types";

let seq = 0;
const entry = (p: Partial<Entry>): Entry => ({
  id: `e${++seq}`, entry_type: "expense", main_category: "餐飲", sub_category: "晚餐", amount: 100, currency: "TWD",
  entry_date: "2026-10-28", notes: null, account_id: "cash", transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});

describe("daySummary", () => {
  it("first entry names the day; other categories follow; more than three entries add a count", () => {
    expect(daySummary([entry({ main_category: "餐飲", sub_category: "晚餐" }), entry({ main_category: "交通", sub_category: "捷運" })])).toEqual({ cat: "餐飲", det: "・晚餐　交通" });
    expect(daySummary([entry({}), entry({}), entry({}), entry({})]).det).toContain("4 筆");
  });
  it("a note beats the sub-category label; a lone entry has no tail", () => {
    expect(daySummary([entry({ notes: "洗衣精", main_category: "日用購物", sub_category: null })])).toEqual({ cat: "日用購物", det: "・洗衣精" });
  });
  it("transfers read as 轉帳", () => {
    expect(daySummary([entry({ entry_type: "transfer", main_category: "轉帳", sub_category: "other" })]).cat).toBe("轉帳");
  });
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

  it("lists only days that have live entries, plus today", () => {
    const days = ledger.weeks.flatMap((w) => w.rows.map((r) => r.day));
    expect(days).toEqual([1, 3, 4, 5, 28]);
  });
  it("transfers and other currencies never reach income or expense", () => {
    expect(ledger.income).toBe(58000);
    expect(ledger.expense).toBe(100 + 300 + 680);
    const d4 = ledger.weeks.flatMap((w) => w.rows).find((r) => r.day === 4)!;
    expect(d4.expense).toBe(300);
    expect(d4.excluded).toBe(true);
    expect(ledger.weeks.flatMap((w) => w.rows).find((r) => r.day === 5)!.expense).toBe(0);
  });
  it("neighbouring months do not leak in; week totals sum to the month", () => {
    expect(ledger.weeks.reduce((s, w) => s + w.expense, 0)).toBe(ledger.expense);
    expect(ledger.weeks.reduce((s, w) => s + w.income, 0)).toBe(ledger.income);
  });
  it("weeks end on Saturday, carry their span, and weeks with no rows are left out", () => {
    expect(ledger.weeks.map((w) => [w.start, w.end])).toEqual([[1, 3], [4, 10], [25, 31]]);
  });
  it("marks today only in the current month", () => {
    expect(ledger.weeks.flatMap((w) => w.rows).filter((r) => r.isToday).map((r) => r.day)).toEqual([28]);
    const other = buildLedger({ year: 2026, month: 10, entries, today: "2026-11-02" });
    expect(other.weeks.flatMap((w) => w.rows).some((r) => r.isToday)).toBe(false);
  });
  it("net is income minus expense; an empty month is all zeros with no rows", () => {
    expect(ledger.net).toBe(58000 - 1080);
    const empty = buildLedger({ year: 2026, month: 2, entries: [], today: "2026-10-28" });
    expect(empty).toMatchObject({ income: 0, expense: 0, net: 0, weeks: [] });
  });
});
