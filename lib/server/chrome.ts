import { recentCategories } from "@/lib/domain/categories";
import type { LedgerAccount } from "@/lib/domain/types";
import { currentMonth, monthRange } from "@/lib/time";
import { getUserId } from "./auth";
import { listAccounts } from "./repos/accounts";
import { listEntries } from "./repos/entries";
import { createServerClient } from "./supabase";

/** What the entry sheet needs on every page: accounts, and the categories used lately. */
export async function loadEntryChrome(): Promise<{
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
}> {
  const userId = await getUserId();
  const client = await createServerClient();
  const { year, month } = currentMonth();
  const prev = month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1);
  const [accounts, entries] = await Promise.all([
    listAccounts(client, userId),
    listEntries(client, userId, { start: prev.start, end: monthRange(year, month).end }),
  ]);
  return { accounts, recentCategories: recentCategories(entries, 5) };
}
