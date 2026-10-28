import { describe, expect, it } from "vitest";
import { buildRecon, latestByAccount } from "./recon";
import type { Entry, LedgerAccount } from "./types";

const acct = (id: string, kind: LedgerAccount["kind"], opening: number, archived = false): LedgerAccount => ({
  id, kind, name: id, opening_balance: opening, opening_date: "2026-01-01", sort_order: 0, archived,
});
const rec = (account_id: string, statement_date: string, statement_balance: number, book_balance: number) => ({
  account_id, statement_date, statement_balance, book_balance, diff: book_balance - statement_balance,
});
const spend = (account_id: string, amount: number): Entry => ({
  id: `${account_id}${amount}`, entry_type: "expense", main_category: "餐飲", sub_category: null, amount, currency: "TWD",
  entry_date: "2026-10-01", notes: null, account_id, transfer_account_id: null, deleted_at: null, is_recurring: false,
});

describe("latestByAccount", () => {
  it("keeps the most recent statement_date per account", () => {
    const m = latestByAccount([rec("a", "2026-09-01", 1, 1), rec("a", "2026-10-01", 2, 3), rec("b", "2026-08-01", 5, 5)]);
    expect(m.get("a")?.statement_balance).toBe(2);
    expect(m.size).toBe(2);
  });
});

describe("buildRecon", () => {
  const accounts = [acct("cash", "cash", 1000), acct("card", "credit_card", 0), acct("old", "bank", 0, true)];
  it("uses the latest reconciliation per account; an account never reconciled has no statement or diff", () => {
    const r = buildRecon({
      accounts,
      entries: [spend("cash", 100), spend("card", 3150)],
      reconciliations: [rec("card", "2026-10-20", -2830, -3150), rec("card", "2026-09-20", -1, -1)],
    });
    expect(r.rows.map((x) => x.id)).toEqual(["cash", "card"]);
    expect(r.rows[0]).toMatchObject({ book: 900, statement: null, diff: null, matched: null });
    expect(r.rows[1]).toMatchObject({ book: -3150, statement: -2830, diff: -320, matched: false });
  });
  it("counts matched, differing and unreconciled accounts; the total diff keeps the card's sign", () => {
    const r = buildRecon({
      accounts,
      entries: [],
      reconciliations: [rec("cash", "2026-10-01", 1000, 1000), rec("card", "2026-10-20", -2830, -3150)],
    });
    expect(r).toMatchObject({ matchedCount: 1, differingCount: 1, unreconciledCount: 0, totalDiff: -320 });
  });
  it("no accounts, no rows", () => {
    expect(buildRecon({ accounts: [], entries: [], reconciliations: [] }).rows).toEqual([]);
  });
});

describe("same-day re-reconciliation", () => {
  it("the one saved later wins, however the rows are ordered", () => {
    const wrong = { ...rec("card", "2026-10-29", -3000, -3785), created_at: "2026-10-29T10:00:00Z" };
    const right = { ...rec("card", "2026-10-29", -3785, -3785), created_at: "2026-10-29T10:05:00Z" };
    expect(latestByAccount([wrong, right]).get("card")?.diff).toBe(0);
    expect(latestByAccount([right, wrong]).get("card")?.diff).toBe(0);
  });
});
