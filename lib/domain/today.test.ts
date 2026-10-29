import { describe, expect, it } from "vitest";
import { buildToday } from "./today";
import type { Entry, LedgerAccount } from "./types";

let seq = 0;
const entry = (p: Partial<Entry>): Entry => ({
  id: `e${++seq}`, entry_type: "expense", main_category: "餐飲", sub_category: "午餐", amount: 100, currency: "TWD",
  entry_date: "2026-10-28", notes: null, account_id: "cash", transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});
const account = (id: string, kind: LedgerAccount["kind"], opening: number): LedgerAccount => ({
  id, kind, name: id, opening_balance: opening, opening_date: "2026-01-01", sort_order: 0, archived: false,
});
const TODAY = "2026-10-28";
const base = { today: TODAY, entries: [] as Entry[], accounts: [] as LedgerAccount[], budgets: [], reconciliations: [] };

describe("today's list and total", () => {
  it("counts only today's TWD expenses; transfers and other currencies are listed or ignored, never summed", () => {
    const v = buildToday({
      ...base,
      entries: [
        entry({ amount: 180 }),
        entry({ amount: 120 }),
        entry({ amount: 999, entry_type: "transfer", main_category: "轉帳", sub_category: "other", transfer_account_id: "bank" }),
        entry({ amount: 25, currency: "JPY" }),
        entry({ amount: 50, entry_date: "2026-10-27" }),
        entry({ amount: 70, deleted_at: "2026-10-28T00:00:00Z" }),
        entry({ amount: 500, entry_type: "income", main_category: "薪資" }),
      ],
    });
    expect(v.todayExpense).toBe(300);
    expect(v.todayRows.map((e) => e.amount).sort()).toEqual([120, 180, 25, 500, 999].sort());
  });
  it("month entries on the last day of the previous month do not leak into today", () => {
    expect(buildToday({ ...base, today: "2026-11-01", entries: [entry({ entry_date: "2026-10-31", amount: 77 })] }).todayExpense).toBe(0);
  });
});

describe("accounts", () => {
  it("balances and total; a credit card shows negative", () => {
    const v = buildToday({
      ...base,
      accounts: [account("cash", "cash", 1000), account("card", "credit_card", 0)],
      entries: [entry({ amount: 200, account_id: "card" }), entry({ amount: 100, account_id: "cash" })],
    });
    expect(v.accounts.map((a) => [a.name, a.balance])).toEqual([["cash", 900], ["card", -200]]);
    expect(v.totalBalance).toBe(700);
  });
});

describe("budget", () => {
  const budgets = [{ main_category: "餐飲", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 }];
  it("is null when no budget exists", () => {
    expect(buildToday(base).budget).toBeNull();
  });
  it("sums only budgeted categories and reports percent and projection", () => {
    const v = buildToday({
      ...base,
      budgets,
      entries: [entry({ amount: 400 }), entry({ amount: 900, main_category: "交通", sub_category: "捷運" })],
    });
    expect(v.budget).toMatchObject({ spent: 400, available: 1000, percent: 40 });
    expect(v.budget?.projected).toBeCloseTo((400 / 28) * 31, 5);
  });
  it("daily has one slot per day of the month and covers all expenses", () => {
    const v = buildToday({ ...base, budgets, entries: [entry({ amount: 400 }), entry({ amount: 9, main_category: "交通", entry_date: "2026-10-01" })] });
    expect(v.daily).toHaveLength(31);
    expect(v.daily[27]).toBe(400);
    expect(v.daily[0]).toBe(9);
  });
});

describe("alerts", () => {
  const budgets = [{ main_category: "餐飲", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 }];
  it("an over-budget category alerts first, with the overage", () => {
    const v = buildToday({
      ...base, budgets,
      entries: [entry({ amount: 1200 }), entry({ main_category: "其他", sub_category: "other", amount: 10 })],
    });
    expect(v.alerts[0]).toMatchObject({ kind: "budget-over", subject: "餐飲", emphasis: "NT$ 200", href: "/budget" });
  });
  it("several budget problems share one row, worst first, and leave the other slots to the books", () => {
    const two = [
      { main_category: "餐飲", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 },
      { main_category: "交通", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 },
      { main_category: "居住", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 },
    ];
    const v = buildToday({
      ...base,
      budgets: two,
      entries: [
        entry({ amount: 1200 }),
        entry({ amount: 1300, main_category: "交通", sub_category: "捷運" }),
        entry({ amount: 850, main_category: "居住", sub_category: "房租" }),
        entry({ amount: 80, entry_date: "2026-10-12", notes: "x" }),
        entry({ amount: 80, entry_date: "2026-10-12", notes: "x" }),
      ],
    });
    expect(v.alerts.map((a) => a.kind)).toEqual(["budget-over", "duplicate"]);
    expect(v.alerts[0]).toMatchObject({ subject: "3 個科目", body: "餐飲、交通 超支；居住 接近預算", href: "/budget" });
  });
  it("a merged row with only warnings is a warning, not an overrun", () => {
    const two = [
      { main_category: "餐飲", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 },
      { main_category: "交通", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 },
    ];
    const v = buildToday({ ...base, budgets: two, entries: [entry({ amount: 850 }), entry({ amount: 900, main_category: "交通", sub_category: "捷運" })] });
    expect(v.alerts).toHaveLength(1);
    expect(v.alerts[0]).toMatchObject({ kind: "budget-warning", body: "餐飲、交通 接近預算" });
  });
  it("a reconcile difference shows the stored sentence", () => {
    const v = buildToday({
      ...base,
      accounts: [account("card", "credit_card", 0)],
      reconciliations: [{ account_id: "card", statement_date: "2026-10-20", statement_balance: -2830, book_balance: -3150, diff: -320 }],
    });
    expect(v.alerts[0]).toMatchObject({ kind: "reconcile", href: "/settings/accounts" });
    expect(v.alerts[0].text).toContain("帳簿比實際多欠 320");
  });
  it("a matched reconciliation does not alert", () => {
    const v = buildToday({
      ...base,
      accounts: [account("card", "credit_card", 0)],
      reconciliations: [{ account_id: "card", statement_date: "2026-10-20", statement_balance: -100, book_balance: -100, diff: 0 }],
    });
    expect(v.alerts).toEqual([]);
  });
  it("uncategorized this month counts, and at most three alerts are shown in priority order", () => {
    const v = buildToday({
      ...base,
      budgets,
      accounts: [account("card", "credit_card", 0)],
      reconciliations: [{ account_id: "card", statement_date: "2026-10-20", statement_balance: -1, book_balance: -2, diff: -1 }],
      entries: [
        entry({ amount: 1200 }),
        entry({ main_category: "其他", sub_category: "other", amount: 10 }),
        entry({ main_category: "其他", sub_category: null, amount: 11, entry_date: "2026-10-03" }),
        entry({ main_category: "其他", sub_category: "other", amount: 10, entry_date: "2026-09-30" }),
      ],
    });
    expect(v.alerts.map((a) => a.kind)).toEqual(["budget-over", "reconcile", "uncategorized"]);
    expect(v.alerts[2].subject).toBe("2 筆");
  });
  it("empty ledger has no alerts", () => {
    expect(buildToday(base).alerts).toEqual([]);
  });
});

describe("missing recurring alert", () => {
  const rent = { id: "r1", name: "房租", due_day: 5, main: "居住", sub: "房租" };
  it("alerts when a recurring item is 3+ days past due with no entry this month, after the budget and data alerts", () => {
    const v = buildToday({ ...base, recurring: [rent] });
    expect(v.alerts).toEqual([
      expect.objectContaining({ kind: "missing-recurring", subject: "房租", body: "本月還沒記帳", actionLabel: "去記帳", preset: { main: "居住", sub: "房租", notes: "房租" } }),
    ]);
  });
  it("falls back to the recurring settings page when the rule carries no category", () => {
    const v = buildToday({ ...base, recurring: [{ id: "r1", name: "房租", due_day: 5 }] });
    expect(v.alerts[0]).toMatchObject({ href: "/settings/recurring", preset: undefined });
  });
  it("stays quiet once an entry names it", () => {
    const v = buildToday({ ...base, recurring: [rent], entries: [entry({ notes: "房租 10 月" })] });
    expect(v.alerts).toEqual([]);
  });
  it("does nothing without recurring input", () => {
    expect(buildToday(base).alerts).toEqual([]);
  });
});

describe("budget rows for the desktop table", () => {
  const budgets = [
    { main_category: "餐飲", budget_amount: 1000, rollover_amount: 0, warning_threshold: 0.8 },
    { main_category: "交通", budget_amount: 2000, rollover_amount: 300, warning_threshold: 0.8 },
  ];
  const v = buildToday({
    ...base,
    budgets,
    entries: [entry({ amount: 400 }), entry({ main_category: "交通", sub_category: "捷運", amount: 150 })],
  });
  it("has one row per budget with budget (incl. rollover), spent and the shared progress", () => {
    expect(v.budgetRows.map((r) => [r.main, r.budget, r.spent, r.progress.remaining])).toEqual([
      ["餐飲", 1000, 400, 600],
      ["交通", 2300, 150, 2150],
    ]);
  });
  it("sums to the same totals the 今日 summary shows", () => {
    const sum = (f: (r: (typeof v.budgetRows)[number]) => number) => v.budgetRows.reduce((s, r) => s + f(r), 0);
    expect(sum((r) => r.budget)).toBe(v.budget!.available);
    expect(sum((r) => r.spent)).toBe(v.budget!.spent);
    expect(sum((r) => r.progress.projected)).toBeCloseTo(v.budget!.projected, 6);
  });
  it("is empty without budgets", () => {
    expect(buildToday(base).budgetRows).toEqual([]);
  });
});

describe("account balances are as of today", () => {
  it("a future-dated entry this month counts for the month's budget but not for any balance", () => {
    const v = buildToday({
      ...base,
      accounts: [account("cash", "cash", 1000)],
      budgets: [{ main_category: "餐飲", budget_amount: 5000, rollover_amount: 0, warning_threshold: 0.8 }],
      entries: [entry({ amount: 100, account_id: "cash" }), entry({ amount: 400, account_id: "cash", entry_date: "2026-10-31" })],
    });
    expect(v.accounts[0].balance).toBe(900);
    expect(v.totalBalance).toBe(900);
    expect(v.budget?.spent).toBe(500);
  });
});

describe("spending outside any budget", () => {
  const budgets = [{ main_category: "家庭", budget_amount: 2000, rollover_amount: 0, warning_threshold: 0.8 }];
  it("totals this month's spending in categories without a budget, largest first, and leaves budget progress alone", () => {
    const v = buildToday({
      ...base,
      budgets,
      entries: [
        entry({ main_category: "飲食", amount: 700 }),
        entry({ main_category: "旅行", amount: 1500, entry_date: "2026-10-05" }),
        entry({ main_category: "飲食", amount: 300, entry_date: "2026-10-06" }),
        entry({ main_category: "家庭", amount: 100 }),
        entry({ main_category: "飲食", amount: 999, entry_date: "2026-09-30" }),
        entry({ main_category: "薪資", entry_type: "income", amount: 5000 }),
      ],
    });
    expect(v.unbudgeted).toEqual({ total: 2500, rows: [{ main: "旅行", spent: 1500 }, { main: "飲食", spent: 1000 }] });
    expect(v.budget?.spent).toBe(100);
  });
  it("is empty when everything spent is budgeted", () => {
    expect(buildToday({ ...base, budgets, entries: [entry({ main_category: "家庭", amount: 100 })] }).unbudgeted).toEqual({ total: 0, rows: [] });
  });
});

describe("alert destinations", () => {
  it("a duplicate group links to the day it happened, not the whole book", () => {
    const v = buildToday({ ...base, entries: [entry({ amount: 80, entry_date: "2026-10-12" }), entry({ amount: 80, entry_date: "2026-10-12" })] });
    expect(v.alerts[0]).toMatchObject({ kind: "duplicate", href: "/ledger?m=2026-10#d-12" });
  });
  it("an uncategorized alert links to the earliest such day this month", () => {
    const v = buildToday({
      ...base,
      entries: [
        entry({ main_category: "其他", sub_category: "other", entry_date: "2026-10-20" }),
        entry({ main_category: "其他", sub_category: "other", entry_date: "2026-10-03", amount: 55 }),
      ],
    });
    expect(v.alerts[0]).toMatchObject({ kind: "uncategorized", href: "/ledger?m=2026-10#d-03" });
  });
});
