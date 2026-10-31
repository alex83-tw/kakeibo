import { describe, expect, it } from "vitest";
import { accountsClose, budgetClose, closeState, isClosed } from "./month-end";
import type { Entry, LedgerAccount } from "./types";

const acct = (id: string, p: Partial<LedgerAccount> = {}): LedgerAccount => ({ id, kind: "bank", name: id, opening_balance: 1000, opening_date: "2026-01-01", sort_order: 0, archived: false, ...p });
const e = (entry_date: string, entry_type: Entry["entry_type"], amount: number, p: Partial<Entry> = {}): Entry => ({
  id: entry_date + amount, entry_type, main_category: "餐飲", sub_category: null, amount, currency: "TWD", entry_date, notes: null, account_id: "a", transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});
const OCT = { start: "2026-10-01", end: "2026-10-31" };

describe("accountsClose", () => {
  const entries = [
    e("2026-09-10", "income", 500),
    e("2026-10-02", "income", 3000),
    e("2026-10-03", "expense", 400),
    e("2026-10-04", "transfer", 200, { account_id: "a", transfer_account_id: "b" }),
    e("2026-11-01", "expense", 999),
    e("2026-10-05", "expense", 50, { deleted_at: "x" }),
  ];
  it("open + income − expense + transfer = close, per account, month only", () => {
    const [a, b] = accountsClose([acct("a"), acct("b", { opening_balance: 0 })], entries, OCT);
    expect(a).toMatchObject({ open: 1500, income: 3000, expense: 400, transfer: -200, close: 3900 });
    expect(b).toMatchObject({ open: 0, income: 0, expense: 0, transfer: 200, close: 200 });
    for (const x of [a, b]) expect(x.open + x.income - x.expense + x.transfer).toBe(x.close);
  });
  it("leaves archived accounts out and ignores movements before an account's opening date", () => {
    const r = accountsClose([acct("a", { opening_date: "2026-10-03" }), acct("z", { archived: true })], entries, OCT);
    expect(r.map((x) => x.id)).toEqual(["a"]);
    expect(r[0]).toMatchObject({ open: 1000, income: 0, expense: 400 });
  });
});

describe("budgetClose", () => {
  const b = (main_category: string, budget_amount: number, rollover_amount = 0) => ({ main_category, budget_amount, rollover_amount, warning_threshold: 0.8 });
  const entries = [e("2026-10-03", "expense", 700), e("2026-10-04", "expense", 2500, { main_category: "交通" }), e("2026-11-02", "expense", 100)];
  it("remaining is budget plus carried-in minus spent, negative when over", () => {
    const r = budgetClose([b("餐飲", 1000, 200), b("交通", 2000), b("居住", 500)], [], entries, OCT);
    expect(r).toEqual([
      { main: "餐飲", available: 1200, spent: 700, remaining: 500, nextRollover: null },
      { main: "交通", available: 2000, spent: 2500, remaining: -500, nextRollover: null },
      { main: "居住", available: 500, spent: 0, remaining: 500, nextRollover: null },
    ]);
  });
  it("is closed only when next month carries exactly what is left", () => {
    const rows = budgetClose([b("餐飲", 1000)], [b("餐飲", 1000, 300)], entries, OCT);
    expect(rows[0]).toMatchObject({ remaining: 300, nextRollover: 300 });
    expect(isClosed(rows)).toBe(true);
    expect(isClosed(budgetClose([b("餐飲", 1000)], [b("餐飲", 1000, 0)], entries, OCT))).toBe(false);
    expect(isClosed([])).toBe(false);
  });
  it("tells never closed from closed from changed since", () => {
    const close = (nextRollover: number) => budgetClose([b("餐飲", 1000)], [b("餐飲", 1000, nextRollover)], entries, OCT);
    expect(closeState(budgetClose([b("餐飲", 1000)], [], entries, OCT))).toBe("open"); // no plan next month
    expect(closeState(close(0))).toBe("open"); // a plan with nothing carried
    expect(closeState(close(300))).toBe("closed");
    expect(closeState(close(450))).toBe("stale"); // carried 450, but the entries now leave 300
    expect(closeState([])).toBe("open");
  });
});
