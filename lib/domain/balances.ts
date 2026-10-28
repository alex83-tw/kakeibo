import { dayOfMonth } from "@/lib/time";
import type { Entry, LedgerAccount } from "./types";

type Range = { start: string; end: string };

const counts = (e: Entry) => e.deleted_at === null && e.currency === "TWD";
const inRange = (e: Entry, r: Range) => e.entry_date >= r.start && e.entry_date <= r.end;

/** Opening balance plus every movement on or after the opening date. Transfers are a single row moving money between two accounts. */
export function accountBalance(account: LedgerAccount, entries: Entry[]): number {
  let balance = account.opening_balance;
  for (const e of entries) {
    if (!counts(e) || e.entry_date < account.opening_date) continue;
    if (e.entry_type === "transfer") {
      if (e.account_id === account.id) balance -= e.amount;
      if (e.transfer_account_id === account.id) balance += e.amount;
    } else if (e.account_id === account.id) {
      balance += e.entry_type === "income" ? e.amount : -e.amount;
    }
  }
  return balance;
}

export function totalBalance(accounts: LedgerAccount[], entries: Entry[]): number {
  return accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + accountBalance(a, entries), 0);
}

export function monthSummary(entries: Entry[], range: Range): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (!counts(e) || !inRange(e, range) || e.entry_type === "transfer") continue;
    if (e.entry_type === "income") income += e.amount;
    else expense += e.amount;
  }
  return { income, expense, net: income - expense };
}

/** Expense per day; index 0 is the 1st. Assumes `range` is one calendar month. */
export function dailyExpenses(entries: Entry[], range: Range): number[] {
  const days = new Array<number>(dayOfMonth(range.end)).fill(0);
  for (const e of entries) {
    if (counts(e) && inRange(e, range) && e.entry_type === "expense") days[dayOfMonth(e.entry_date) - 1] += e.amount;
  }
  return days;
}

export function spentByMain(entries: Entry[], range: Range): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (counts(e) && inRange(e, range) && e.entry_type === "expense") {
      out[e.main_category] = (out[e.main_category] ?? 0) + e.amount;
    }
  }
  return out;
}
