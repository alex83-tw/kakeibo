import { recentCategories } from "@/lib/domain/categories";
import { inventoryToTaxonomy } from "@/lib/domain/inventory";
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
  /** Built-in plus recently used categories, so a renamed one shows up in the form. */
  categoryOptions: { expense: Record<string, string[]>; income: Record<string, string[]> };
}> {
  const userId = await getUserId();
  const client = await createServerClient();
  const { year, month } = currentMonth();
  const yearAgo = monthRange(year - 1, month);
  const [accounts, entries] = await Promise.all([
    listAccounts(client, userId),
    listEntries(client, userId, { start: yearAgo.start, end: monthRange(year, month).end }),
  ]);
  return {
    accounts,
    recentCategories: recentCategories(entries, 5),
    categoryOptions: { expense: inventoryToTaxonomy("expense", entries), income: inventoryToTaxonomy("income", entries) },
  };
}
