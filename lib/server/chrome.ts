import { recentCategories } from "@/lib/domain/categories";
import { inventoryToTaxonomy } from "@/lib/domain/inventory";
import type { CategoryRule } from "@/lib/domain/recurring";
import type { LedgerAccount } from "@/lib/domain/types";
import { twToday } from "@/lib/time";
import { getUserId } from "./auth";
import { listAccounts } from "./repos/accounts";
import { listRecentEntries } from "./repos/entries";
import { listCategoryRules } from "./repos/rules";
import { createServerClient } from "./supabase";

/** What the entry sheet needs on every page: accounts, and the categories used lately. */
export async function loadEntryChrome(): Promise<{
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
  /** 自動分類 keywords, matched against an entry's notes as it is typed. */
  rules: CategoryRule[];
  /** Built-in plus recently used categories, so a renamed one shows up in the form. */
  categoryOptions: { expense: Record<string, string[]>; income: Record<string, string[]> };
}> {
  const userId = await getUserId();
  const client = await createServerClient();
  const [accounts, entries, rules] = await Promise.all([listAccounts(client, userId), listRecentEntries(client, userId), listCategoryRules(client, userId)]);
  return {
    accounts,
    rules,
    recentCategories: recentCategories(entries, 5, twToday()),
    categoryOptions: { expense: inventoryToTaxonomy("expense", entries), income: inventoryToTaxonomy("income", entries) },
  };
}
