import { describe, expect, it } from "vitest";
import { applyMemoryFilters, describeFilters, PAGE_SIZE, paginate, parseSearchParams, sortEntries, sqlFilter, sumMatches, toQueryString } from "./search";
import type { Entry } from "./types";

const e = (id: string, p: Partial<Entry> = {}): Entry => ({
  id, entry_type: "expense", main_category: "餐飲", sub_category: "午餐", amount: 100, currency: "TWD", entry_date: "2026-10-05",
  notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});
const none = parseSearchParams({});

describe("parseSearchParams", () => {
  it("empty input means no filter, newest first, page 1", () => {
    expect(none).toEqual({ q: "", type: "", main: "", from: "", to: "", min: null, max: null, sort: "date-desc", page: 1 });
  });
  it("keeps valid values, trims text, and takes the first of a repeated param", () => {
    const f = parseSearchParams({ q: "  全聯 ", type: "income", main: "薪資", from: "2026-01-01", to: "2026-10-31", min: "1,000", max: "5000.5", sort: "amount-asc", page: ["3", "4"] });
    expect(f).toEqual({ q: "全聯", type: "income", main: "薪資", from: "2026-01-01", to: "2026-10-31", min: 1000, max: 5000.5, sort: "amount-asc", page: 3 });
  });
  it("drops anything invalid instead of failing", () => {
    const f = parseSearchParams({ type: "gift", from: "2026-02-30", to: "tomorrow", min: "abc", max: "-5", sort: "random", page: "-2" });
    expect(f).toEqual(none);
    expect(parseSearchParams({ page: "9999999" }).page).toBe(1000);
    expect(parseSearchParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
  it("swaps a reversed date or amount range", () => {
    const f = parseSearchParams({ from: "2026-10-31", to: "2026-10-01", min: "500", max: "100" });
    expect([f.from, f.to, f.min, f.max]).toEqual(["2026-10-01", "2026-10-31", 100, 500]);
  });
});

describe("toQueryString", () => {
  it("writes only what differs from the defaults, and round-trips through parseSearchParams", () => {
    expect(toQueryString(none)).toBe("");
    const f = parseSearchParams({ q: "全聯 汐止", type: "expense", min: "100", sort: "amount-desc", page: "2" });
    const qs = toQueryString(f);
    expect(qs).toBe("?q=%E5%85%A8%E8%81%AF+%E6%B1%90%E6%AD%A2&type=expense&min=100&sort=amount-desc&page=2");
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(qs)))).toEqual(f);
  });
  it("can write another page without touching the filters", () => {
    expect(toQueryString(parseSearchParams({ q: "a", page: "4" }), 1)).toBe("?q=a");
  });
});

describe("sqlFilter", () => {
  it("passes on only type, main category and the date range", () => {
    const f = parseSearchParams({ q: "x", type: "expense", main: "餐飲", from: "2026-10-01", min: "5" });
    expect(sqlFilter(f)).toEqual({ type: "expense", main: "餐飲", from: "2026-10-01", to: "" });
  });
});

describe("applyMemoryFilters", () => {
  const names = { a1: "現金", a2: "信用卡" };
  const rows = [
    e("1", { notes: "全聯 汐止", account_id: "a1", amount: 300 }),
    e("2", { main_category: "交通", sub_category: "捷運", amount: 30, account_id: "a2" }),
    e("3", { entry_type: "transfer", main_category: "轉帳", sub_category: null, amount: 5000, account_id: "a1", transfer_account_id: "a2" }),
    e("4", { amount: 120, currency: "TWD", foreign: { currency: "JPY", amount: 550, rate: 0.22 }, notes: "Lawson" }),
  ];
  const ids = (f: Record<string, string>) => applyMemoryFilters(rows, parseSearchParams(f), names).map((r) => r.id);
  it("matches text in notes, category (with 一般 for the default sub), and account names, ignoring case", () => {
    expect(ids({ q: "全聯" })).toEqual(["1"]);
    expect(ids({ q: "捷運" })).toEqual(["2"]);
    expect(ids({ q: "信用卡" })).toEqual(["2", "3"]); // as account, and as the transfer target
    expect(ids({ q: "lawson" })).toEqual(["4"]);
    expect(ids({ q: "一般" })).toEqual(["3"]);
  });
  it("amount range is inclusive and on the TWD amount, so a converted foreign row is judged as TWD", () => {
    expect(ids({ min: "120", max: "300" })).toEqual(["1", "4"]);
    expect(ids({ min: "5000" })).toEqual(["3"]);
  });
  it("text and amount combine", () => {
    expect(ids({ q: "現金", min: "1000" })).toEqual(["3"]);
  });
});

describe("sortEntries", () => {
  const rows = [e("new", { entry_date: "2026-10-09", amount: 50 }), e("mid", { entry_date: "2026-10-05", amount: 50 }), e("old", { entry_date: "2026-10-01", amount: 900 })];
  it("date-desc keeps the repo's order; date-asc is its reverse", () => {
    expect(sortEntries(rows, "date-desc").map((r) => r.id)).toEqual(["new", "mid", "old"]);
    expect(sortEntries(rows, "date-asc").map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });
  it("amount sorts, ties keep newest first, and the input is not mutated", () => {
    expect(sortEntries(rows, "amount-desc").map((r) => r.id)).toEqual(["old", "new", "mid"]);
    expect(sortEntries(rows, "amount-asc").map((r) => r.id)).toEqual(["new", "mid", "old"]);
    expect(rows.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);
  it("slices by page and reports totals", () => {
    const p = paginate(items, 2);
    expect(p).toMatchObject({ page: 2, pages: 3, total: 120 });
    expect(p.items).toHaveLength(PAGE_SIZE);
    expect(p.items[0]).toBe(50);
    expect(paginate(items, 3).items).toHaveLength(20);
  });
  it("clamps a page past the end (rows were deleted since the link was made) and handles empty", () => {
    expect(paginate(items, 9).page).toBe(3);
    expect(paginate([], 5)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
});

describe("sumMatches", () => {
  it("adds expenses and incomes in TWD; transfers and unconverted foreign rows do not count", () => {
    const rows = [e("a", { amount: 100 }), e("b", { amount: 50 }), e("c", { entry_type: "income", amount: 900 }), e("d", { entry_type: "transfer", amount: 700 }), e("f", { currency: "USD", amount: 10 })];
    expect(sumMatches(rows)).toEqual({ expense: 150, income: 900 });
  });
});

describe("describeFilters", () => {
  it("is empty without criteria, and lists each active one", () => {
    expect(describeFilters(none)).toBe("");
    expect(describeFilters(parseSearchParams({ q: "全聯", type: "expense", main: "餐飲", from: "2026-01-01", min: "100" }))).toBe("「全聯」　支出　餐飲　2026-01-01 起　100 元以上");
    expect(describeFilters(parseSearchParams({ to: "2026-10-31", min: "1", max: "9" }))).toBe("至 2026-10-31　1～9 元");
  });
});
