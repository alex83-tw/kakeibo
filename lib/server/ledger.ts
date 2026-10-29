import { cache } from "react";
import { getUserId } from "./auth";
import { listAccounts } from "./repos/accounts";
import { listEntries } from "./repos/entries";
import { createServerClient } from "./supabase";
import { monthRange } from "@/lib/time";

/** One month's entries and the account names, shared by the 帳本 slot and the /ledger page in one request. */
export const loadLedgerMonth = cache(async (year: number, month: number) => {
  const userId = await getUserId();
  const client = await createServerClient();
  const [entries, accounts] = await Promise.all([listEntries(client, userId, monthRange(year, month)), listAccounts(client, userId)]);
  return { entries, accountNames: Object.fromEntries(accounts.map((a) => [a.id, a.name])) as Record<string, string> };
});
