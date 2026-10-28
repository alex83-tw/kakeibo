import { describe, expect, it } from "vitest";
import { accountBalance, dailyExpenses, monthSummary, spentByMain, totalBalance } from "./balances";
import type { Entry, LedgerAccount } from "./types";

let seq = 0;
function entry(p: Partial<Entry>): Entry {
  return {
    id: `e${++seq}`,
    entry_type: "expense",
    main_category: "餐飲",
    sub_category: null,
    amount: 100,
    currency: "TWD",
    entry_date: "2026-10-28",
    notes: null,
    account_id: "cash",
    transfer_account_id: null,
    deleted_at: null,
    is_recurring: false,
    ...p,
  };
}
function account(p: Partial<LedgerAccount>): LedgerAccount {
  return { id: "cash", kind: "cash", name: "現金", opening_balance: 8000, opening_date: "2026-10-01", sort_order: 0, archived: false, ...p };
}
const range = { start: "2026-10-01", end: "2026-10-31" };

describe("accountBalance", () => {
  it("subtracts expenses and adds income", () => {
    expect(accountBalance(account({}), [entry({ amount: 180 })])).toBe(7820);
    expect(accountBalance(account({}), [entry({ entry_type: "income", main_category: "薪資", amount: 1000 })])).toBe(9000);
  });
  it("moves a transfer from one account to the other without changing the total", () => {
    const cash = account({});
    const bank = account({ id: "bank", kind: "bank", name: "銀行", opening_balance: 0 });
    const t = entry({ entry_type: "transfer", main_category: "轉帳", sub_category: "other", amount: 500, account_id: "cash", transfer_account_id: "bank" });
    expect(accountBalance(cash, [t])).toBe(7500);
    expect(accountBalance(bank, [t])).toBe(500);
    expect(totalBalance([cash, bank], [t])).toBe(8000);
  });
  it("ignores soft-deleted, non-TWD and pre-opening-date entries", () => {
    const list = [
      entry({ amount: 50, deleted_at: "2026-10-28T00:00:00Z" }),
      entry({ amount: 60, currency: "USD" }),
      entry({ amount: 70, entry_date: "2026-09-30" }),
    ];
    expect(accountBalance(account({}), list)).toBe(8000);
  });
  it("shows a credit card as negative", () => {
    const card = account({ id: "card", kind: "credit_card", name: "信用卡", opening_balance: 0 });
    expect(accountBalance(card, [entry({ account_id: "card", amount: 3150 })])).toBe(-3150);
  });
});

describe("totalBalance", () => {
  it("skips archived accounts and entries with no account", () => {
    const a = account({});
    const old = account({ id: "old", opening_balance: 999, archived: true });
    expect(totalBalance([a, old], [entry({ account_id: null, amount: 500 })])).toBe(8000);
  });
});

describe("monthSummary", () => {
  it("sums income and expense, excluding transfers, deleted and non-TWD rows", () => {
    const list = [
      entry({ entry_type: "income", main_category: "薪資", amount: 58000, account_id: "bank" }),
      entry({ amount: 38420 }),
      entry({ entry_type: "transfer", main_category: "轉帳", amount: 9999, account_id: "cash", transfer_account_id: "bank" }),
      entry({ amount: 777, deleted_at: "x" }),
      entry({ amount: 888, currency: "JPY" }),
    ];
    expect(monthSummary(list, range)).toEqual({ income: 58000, expense: 38420, net: 19580 });
  });
  it("respects month boundaries", () => {
    const list = [
      entry({ entry_date: "2026-09-30", amount: 1 }),
      entry({ entry_date: "2026-10-01", amount: 10 }),
      entry({ entry_date: "2026-10-31", amount: 100 }),
      entry({ entry_date: "2026-11-01", amount: 1000 }),
    ];
    expect(monthSummary(list, range).expense).toBe(110);
  });
});

describe("dailyExpenses / spentByMain", () => {
  const list = [
    entry({ entry_date: "2026-10-28", amount: 180 }),
    entry({ entry_date: "2026-10-28", amount: 120, main_category: "交通" }),
    entry({ entry_date: "2026-10-01", amount: 40 }),
    entry({ entry_type: "income", main_category: "薪資", amount: 5000, entry_date: "2026-10-28" }),
    entry({ entry_type: "transfer", main_category: "轉帳", amount: 300, entry_date: "2026-10-28", transfer_account_id: "bank" }),
  ];
  it("has one slot per day and sums expenses only", () => {
    const d = dailyExpenses(list, range);
    expect(d).toHaveLength(31);
    expect(d[27]).toBe(300);
    expect(d[0]).toBe(40);
  });
  it("groups expenses by main category", () => {
    expect(spentByMain(list, range)).toEqual({ 餐飲: 220, 交通: 120 });
  });
  it("daily sum equals month expense equals sum by main", () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(dailyExpenses(list, range))).toBe(monthSummary(list, range).expense);
    expect(sum(Object.values(spentByMain(list, range)))).toBe(monthSummary(list, range).expense);
  });
});
