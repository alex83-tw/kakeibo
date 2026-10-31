import Link from "next/link";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResults } from "@/components/search/SearchResults";
import { applyMemoryFilters, parseSearchParams, sortEntries } from "@/lib/domain/search";
import { getUserId } from "@/lib/server/auth";
import { loadEntryChrome } from "@/lib/server/chrome";
import { searchEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { twToday } from "@/lib/time";

/**
 * 搜尋：跨月份找帳目。條件全在網址裡（見 parseSearchParams）；日期、類型、科目由資料庫篩，
 * 金額與關鍵字在記憶體篩（外幣要換算成台幣後才有可比的金額），最多讀 SEARCH_CAP 筆。
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseSearchParams(await searchParams);
  const userId = await getUserId();
  const client = await createServerClient();
  const [{ entries, truncated }, { accounts, categoryOptions }] = await Promise.all([searchEntries(client, userId, f), loadEntryChrome()]);
  const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const shown = sortEntries(applyMemoryFilters(entries, f, accountNames), f.sort);

  return (
    <>
      <Run label="搜尋" />
      <Head
        title="搜尋"
        aside={
          <Link className="act" href="/ledger">
            回帳本
          </Link>
        }
      />
      <SearchForm f={f} expenseMains={Object.keys(categoryOptions.expense)} incomeMains={Object.keys(categoryOptions.income)} />
      <SearchResults entries={shown} f={f} truncated={truncated} accountNames={accountNames} today={twToday()} />
    </>
  );
}
