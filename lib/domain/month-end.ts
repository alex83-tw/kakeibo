import type { BudgetRow } from "@/lib/server/repos/budgets";
import { accountBalance, spentByMain } from "./balances";
import type { Entry, LedgerAccount } from "./types";

type Range = { start: string; end: string };

export interface AccountClose {
  id: string;
  name: string;
  /** balance at the end of the day before the month starts */
  open: number;
  income: number;
  expense: number;
  /** transfers in minus transfers out */
  transfer: number;
  close: number;
}

const live = (e: Entry) => e.deleted_at === null && e.currency === "TWD";

/** Each live account over one month: where it started, what moved, where it ended. open + income − expense + transfer = close. */
export function accountsClose(accounts: LedgerAccount[], entries: Entry[], range: Range): AccountClose[] {
  const before = entries.filter((e) => e.entry_date < range.start);
  const through = entries.filter((e) => e.entry_date <= range.end);
  return accounts
    .filter((a) => !a.archived)
    .map((a) => {
      let income = 0;
      let expense = 0;
      let transfer = 0;
      for (const e of entries) {
        if (!live(e) || e.entry_date < range.start || e.entry_date > range.end || e.entry_date < a.opening_date) continue;
        if (e.entry_type === "transfer") {
          if (e.account_id === a.id) transfer -= e.amount;
          if (e.transfer_account_id === a.id) transfer += e.amount;
        } else if (e.account_id === a.id) {
          if (e.entry_type === "income") income += e.amount;
          else expense += e.amount;
        }
      }
      return { id: a.id, name: a.name, open: accountBalance(a, before), income, expense, transfer, close: accountBalance(a, through) };
    });
}

export interface BudgetClose {
  main: string;
  /** budget plus what was carried in */
  available: number;
  spent: number;
  /** available − spent; negative when over budget. This is what carries to next month. */
  remaining: number;
  /** what next month already has carried in, null when next month has no plan for it yet */
  nextRollover: number | null;
}

/**
 * The month's budgets settled against what was spent. `remaining` carries into next month (an overspend carries as a negative),
 * computed from this month alone, so running the close again after more entries replaces the figure instead of adding to it.
 */
export function budgetClose(budgets: BudgetRow[], next: BudgetRow[], entries: Entry[], range: Range): BudgetClose[] {
  const spent = spentByMain(entries, range);
  const nextBy = new Map(next.map((b) => [b.main_category, b.rollover_amount]));
  return budgets.map((b) => {
    const available = b.budget_amount + b.rollover_amount;
    const s = spent[b.main_category] ?? 0;
    return { main: b.main_category, available, spent: s, remaining: available - s, nextRollover: nextBy.get(b.main_category) ?? null };
  });
}

/** Already closed: every category's next month carries exactly what this month leaves. */
export function isClosed(rows: BudgetClose[]): boolean {
  return rows.length > 0 && rows.every((r) => r.nextRollover === r.remaining);
}
