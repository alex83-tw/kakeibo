import { accountBalance } from "./balances";
import type { AccountKind, Entry, LedgerAccount } from "./types";

export interface ReconciliationRecord {
  account_id: string;
  statement_date: string;
  statement_balance: number;
  book_balance: number;
  diff: number;
  /** breaks ties between reconciliations saved on the same statement_date */
  created_at?: string;
}

export interface ReconRow {
  id: string;
  name: string;
  kind: AccountKind;
  /** the book balance when last reconciled, else the current one */
  book: number;
  statement: number | null;
  diff: number | null;
  matched: boolean | null;
  date: string | null;
}

const newer = (a: ReconciliationRecord, b: ReconciliationRecord) =>
  a.statement_date !== b.statement_date ? a.statement_date > b.statement_date : (a.created_at ?? "") > (b.created_at ?? "");

export function latestByAccount(records: ReconciliationRecord[]): Map<string, ReconciliationRecord> {
  const latest = new Map<string, ReconciliationRecord>();
  for (const r of records) {
    const cur = latest.get(r.account_id);
    if (!cur || newer(r, cur)) latest.set(r.account_id, r);
  }
  return latest;
}

/** Only an account's most recent reconciliation counts: it is matched only if that one has diff 0. */
export function buildRecon(input: {
  accounts: LedgerAccount[];
  entries: Entry[];
  reconciliations: ReconciliationRecord[];
}): { rows: ReconRow[]; matchedCount: number; differingCount: number; unreconciledCount: number; totalDiff: number } {
  const latest = latestByAccount(input.reconciliations);
  const rows: ReconRow[] = input.accounts
    .filter((a) => !a.archived)
    .map((a) => {
      const r = latest.get(a.id);
      return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        book: r ? r.book_balance : accountBalance(a, input.entries),
        statement: r ? r.statement_balance : null,
        diff: r ? r.diff : null,
        matched: r ? r.diff === 0 : null,
        date: r ? r.statement_date : null,
      };
    });
  return {
    rows,
    matchedCount: rows.filter((r) => r.matched === true).length,
    differingCount: rows.filter((r) => r.matched === false).length,
    unreconciledCount: rows.filter((r) => r.matched === null).length,
    totalDiff: Math.round(rows.reduce((s, r) => s + (r.diff ?? 0), 0) * 100) / 100,
  };
}
