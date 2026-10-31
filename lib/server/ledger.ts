import { cache } from "react";
import { totalBalance } from "@/lib/domain/balances";
import { getUserId } from "./auth";
import { listAccounts } from "./repos/accounts";
import { listEntries } from "./repos/entries";
import { createServerClient } from "./supabase";
import { monthRange } from "@/lib/time";

/**
 * One month's entries, the account names and the balance across accounts on the 1st, shared by the 帳本 slot and the /ledger page in one request.
 * The balance reads everything since the earliest opening date, so the running 餘額 column starts from where the books really stood.
 */
export const loadLedgerMonth = cache(async (year: number, month: number) => {
  const userId = await getUserId();
  const client = await createServerClient();
  const range = monthRange(year, month);
  const accounts = await listAccounts(client, userId);
  const from = accounts.reduce((min, a) => (a.opening_date < min ? a.opening_date : min), range.start);
  const all = await listEntries(client, userId, { start: from, end: range.end });
  // ponytail: an account opened mid-month joins the total only from the next month's opening balance
  const open = accounts.filter((a) => a.opening_date <= range.start);
  return {
    entries: all.filter((e) => e.entry_date >= range.start),
    accountNames: Object.fromEntries(accounts.map((a) => [a.id, a.name])) as Record<string, string>,
    opening: accounts.length === 0 ? undefined : totalBalance(open, all.filter((e) => e.entry_date < range.start)),
  };
});
