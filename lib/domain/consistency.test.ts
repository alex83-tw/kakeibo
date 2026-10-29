import { describe, expect, it } from "vitest";
import { accountBalance, dailyExpenses, monthSummary, spentByMain, totalBalance } from "./balances";
import { budgetProgress } from "./budget";
import { buildLedger } from "./ledger";
import { buildRecon } from "./recon";
import { buildToday } from "./today";
import type { Entry, LedgerAccount } from "./types";
import { groupByWeek } from "./weeks";
import { currentMonth, dayOfMonth, monthRange, twToday } from "@/lib/time";

/**
 * One fixed month (2026-10) shown by every screen: 今日, 帳本, 對帳 and the desktop spread all read these
 * numbers through the same domain functions, so they must agree with each other.
 */
let seq = 0;
const e = (entry_date: string, entry_type: Entry["entry_type"], main_category: string, amount: number, account_id: string | null, p: Partial<Entry> = {}): Entry => ({
  id: `e${++seq}`, entry_type, main_category, sub_category: null, amount, currency: "TWD", entry_date, notes: null,
  account_id, transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});
const acc = (id: string, kind: LedgerAccount["kind"], name: string, opening_balance: number, sort_order: number): LedgerAccount => ({
  id, kind, name, opening_balance, opening_date: "2026-10-01", sort_order, archived: false,
});

const accounts = [acc("cash", "cash", "現金", 8690, 0), acc("bank", "bank", "銀行", 40000, 1), acc("card", "credit_card", "信用卡", 0, 2)];

const live: Entry[] = [
  e("2026-10-01", "income", "薪資", 58000, "bank"),
  e("2026-10-02", "expense", "居住", 12000, "bank"),
  e("2026-10-05", "expense", "交通", 1280, "card"),
  e("2026-10-05", "expense", "餐飲", 1870, "card"),
  e("2026-10-07", "expense", "日用購物", 960, "cash"),
  e("2026-10-09", "transfer", "轉帳", 3000, "bank", { transfer_account_id: "cash", sub_category: "other" }),
  e("2026-10-12", "expense", "餐飲", 420, "cash"),
  e("2026-10-15", "expense", "其他", 350, "cash"),
  e("2026-10-18", "transfer", "轉帳", 500, "cash", { transfer_account_id: "bank", sub_category: "other" }),
  e("2026-10-20", "expense", "娛樂休閒", 21540, "bank"),
];
const noise: Entry[] = [
  e("2026-10-04", "expense", "餐飲", 25000, "cash", { currency: "JPY" }),
  e("2026-10-04", "income", "薪資", 100, "bank", { currency: "USD" }),
  e("2026-10-06", "expense", "餐飲", 9999, "cash", { deleted_at: "2026-10-07T00:00:00Z" }),
  e("2026-10-08", "income", "獎金", 5000, "bank", { deleted_at: "2026-10-09T00:00:00Z" }),
];
const all = [...live, ...noise];

const budgets = [
  ["餐飲", 6000], ["交通", 3000], ["居住", 13000], ["日用購物", 2000], ["娛樂休閒", 25000], ["其他", 3000],
].map(([main_category, budget_amount]) => ({ main_category: main_category as string, budget_amount: budget_amount as number, rollover_amount: 0, warning_threshold: 0.8 }));

const range = monthRange(2026, 10);
const TODAY = "2026-10-31";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("one month, every screen", () => {
  const summary = monthSummary(all, range);

  it("matches the spec's example figures", () => {
    expect(summary).toEqual({ income: 58000, expense: 38420, net: 19580 });
    expect(totalBalance(accounts, all)).toBe(68270);
    expect(accountBalance(accounts[2], all)).toBe(-3150);
    expect(sum(budgets.map((b) => b.budget_amount))).toBe(52000);
  });

  it("expense is the same whether summed by month, by day, by category, by week or by ledger", () => {
    const spent = spentByMain(all, range);
    const daily = dailyExpenses(all, range);
    const incomeByDay = new Array<number>(range.days).fill(0);
    for (const x of live) if (x.entry_type === "income") incomeByDay[dayOfMonth(x.entry_date) - 1] += x.amount;
    const weeks = groupByWeek(2026, 10, daily.map((expense, i) => ({ income: incomeByDay[i], expense })));
    const ledger = buildLedger({ year: 2026, month: 10, entries: all, today: TODAY });

    expect(sum(daily)).toBe(summary.expense);
    expect(sum(Object.values(spent))).toBe(summary.expense);
    expect(sum(weeks.map((w) => w.expense))).toBe(summary.expense);
    expect(sum(weeks.map((w) => w.income))).toBe(summary.income);
    expect(ledger).toMatchObject({ income: summary.income, expense: summary.expense, net: summary.net });
    expect(sum(ledger.weeks.map((w) => w.expense))).toBe(summary.expense);
    expect(sum(ledger.weeks.map((w) => w.income))).toBe(summary.income);
  });

  it("remaining budget adds up to total budget minus total spent", () => {
    const spent = spentByMain(all, range);
    const remaining = budgets.map((b) =>
      budgetProgress({ budget: b.budget_amount, rollover: 0, spent: spent[b.main_category] ?? 0, warningThreshold: 0.8, daysElapsed: 31, daysInMonth: 31 }).remaining,
    );
    expect(sum(remaining)).toBe(13580);
    expect(sum(remaining)).toBe(52000 - summary.expense);
  });

  it("transfers move money between accounts and never change the total or the month's income and expense", () => {
    const noTransfers = all.filter((x) => x.entry_type !== "transfer");
    expect(totalBalance(accounts, noTransfers)).toBe(totalBalance(accounts, all));
    expect(monthSummary(noTransfers, range)).toEqual(summary);
    // …but they do move the individual balances
    expect(accountBalance(accounts[0], all)).not.toBe(accountBalance(accounts[0], noTransfers));
  });

  it("other currencies and soft-deleted entries change nothing, anywhere", () => {
    const args = (entries: Entry[]) => ({
      summary: monthSummary(entries, range),
      daily: dailyExpenses(entries, range),
      spent: spentByMain(entries, range),
      total: totalBalance(accounts, entries),
      balances: accounts.map((a) => accountBalance(a, entries)),
      // A line in another currency is still written (as 未納入) with 0 and 0, so compare the numbers, not the lines.
      ledger: (({ income, expense, net, weeks }) => ({ income, expense, net, weeks: weeks.map((w) => [w.income, w.expense]) }))(
        buildLedger({ year: 2026, month: 10, entries, today: TODAY }),
      ),
    });
    expect(args(all)).toEqual(args(live));
    const foreign = buildLedger({ year: 2026, month: 10, entries: all, today: TODAY }).weeks.flatMap((w) => w.lines).filter((l) => l.foreign);
    expect(foreign.map((l) => [l.day, l.income, l.expense])).toEqual([[4, 0, 0], [4, 0, 0]]);
  });

  it("今日, 帳本, 對帳 and the desktop budget table report the same numbers", () => {
    const reconciliations = [{ account_id: "card", statement_date: "2026-10-25", statement_balance: -2830, book_balance: -3150, diff: -320 }];
    const view = buildToday({ today: TODAY, entries: all, accounts, budgets, reconciliations });
    const recon = buildRecon({ accounts, entries: all, reconciliations });
    const ledger = buildLedger({ year: 2026, month: 10, entries: all, today: TODAY });

    expect(view.totalBalance).toBe(totalBalance(accounts, all));
    expect(view.accounts.map((a) => a.balance)).toEqual(accounts.map((a) => accountBalance(a, all)));
    expect(sum(view.daily)).toBe(ledger.expense);
    expect(view.budget).toMatchObject({ spent: ledger.expense, available: 52000, budget: 52000 });
    expect(sum(view.budgetRows.map((r) => r.spent))).toBe(ledger.expense);
    expect(sum(view.budgetRows.map((r) => r.budget))).toBe(52000);
    expect(sum(view.budgetRows.map((r) => r.progress.remaining))).toBe(13580);
    expect(recon.rows.find((r) => r.id === "card")).toMatchObject({ book: -3150, statement: -2830, diff: -320, matched: false });
    expect(recon.totalDiff).toBe(-320);
    expect(view.alerts.find((a) => a.kind === "reconcile")?.text).toContain("帳簿比實際多欠 320");
  });
});

describe("Taiwan time at the month boundary", () => {
  it("10/1 00:30 in Taipei is already October, though it is still 9/30 in UTC", () => {
    const at = new Date("2026-09-30T16:30:00Z");
    expect(twToday(at)).toBe("2026-10-01");
    expect(currentMonth(at)).toEqual({ year: 2026, month: 10 });
    const entry = e(twToday(at), "expense", "餐飲", 100, "cash");
    const october = monthSummary([entry], monthRange(2026, 10));
    const september = monthSummary([entry], monthRange(2026, 9));
    expect([october.expense, september.expense]).toEqual([100, 0]);
  });
  it("10/31 23:30 in Taipei is still October; 11/1 00:30 is November", () => {
    expect(twToday(new Date("2026-10-31T15:30:00Z"))).toBe("2026-10-31");
    expect(twToday(new Date("2026-10-31T16:30:00Z"))).toBe("2026-11-01");
  });
});
