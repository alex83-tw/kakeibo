import Link from "next/link";
import { LineButton } from "@/components/ledger/LineButton";
import { SelectBar, SelectProvider, SelectToggle } from "@/components/ledger/SelectMode";
import { Hint } from "@/components/paper/Hint";
import { amountCell } from "@/components/today/TodayBlock";
import { subLabel } from "@/lib/domain/categories";
import { paginate, sumMatches, toQueryString, SEARCH_CAP, type SearchFilters } from "@/lib/domain/search";
import type { Entry } from "@/lib/domain/types";
import { formatAmount } from "@/lib/money";
import { foldWidth, stripImported } from "@/lib/text";

/** 10/05 for this year, 25/10/05 for another: the page spans years, the ledger never did. */
function shortDate(date: string, thisYear: string): string {
  const [y, m, d] = date.split("-");
  return `${y === thisYear ? "" : `${y.slice(2)}/`}${m}/${d}`;
}

/** The matches, one per line (a line opens its entry), with 選取 for deleting many. `entries` are already filtered and sorted. */
export function SearchResults({
  entries,
  f,
  truncated,
  accountNames,
  today,
}: {
  entries: Entry[];
  f: SearchFilters;
  truncated: boolean;
  accountNames: Record<string, string>;
  today: string;
}) {
  const { items, page, pages, total } = paginate(entries, f.page);
  const { expense, income } = sumMatches(entries);
  const name = (id: string | null) => (id ? (accountNames[id] ?? "") : "");
  const href = (p: number) => `/search${toQueryString(f, p)}`;
  const thisYear = today.slice(0, 4);

  if (total === 0) return <Hint>沒有符合的帳目。放寬條件再試一次。</Hint>;
  return (
    // a selection belongs to one page of one search
    <SelectProvider key={toQueryString(f, page)}>
      <div className="lg-tools">
        <span className="lg-n" role="status">
          共 {total} 筆
          {expense > 0 ? `　支出 ${formatAmount(expense)}` : ""}
          {income > 0 ? `　收入 ${formatAmount(income)}` : ""}
        </span>
        <span className="sf-gap" />
        <SelectToggle />
      </div>
      <SelectBar />
      {truncated ? <Hint>符合的帳目超過 {SEARCH_CAP.toLocaleString("en-US")} 筆，只列出最新的 {SEARCH_CAP.toLocaleString("en-US")} 筆。請縮小條件。</Hint> : null}
      <table className={items.some((e) => e.account_id) ? "rt rt-today rt-search" : "rt rt-today rt-search no-a"}>
        <caption className="sr">搜尋結果，第 {page} 頁；點一行可以修改或刪除</caption>
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">科目</th>
            <th scope="col" className="c-a">
              帳戶
            </th>
            <th scope="col" className="n">
              金額
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const transfer = e.entry_type === "transfer";
            const title = transfer ? "轉帳" : e.main_category;
            const note = [foldWidth(stripImported(e.notes?.trim() ?? "")) || (transfer ? "" : e.sub_category && e.sub_category !== "other" ? subLabel(e.sub_category) : ""), e.foreign ? `${e.foreign.currency} ${formatAmount(e.foreign.amount)}` : ""]
              .filter(Boolean)
              .join("　");
            return (
              <tr key={e.id}>
                <td className="dim">{shortDate(e.entry_date, thisYear)}</td>
                <td className="c">
                  <LineButton entry={e}>
                    <b>{title}</b>
                    {note ? <span className="x-in"> {note}</span> : null}
                    <span className="sr">
                      ，{e.entry_date}，{amountCell(e)}，修改或刪除
                    </span>
                  </LineButton>
                </td>
                <td className="c-a dim">{transfer ? `${name(e.account_id)}→${name(e.transfer_account_id)}` : name(e.account_id)}</td>
                <td className={e.currency === "TWD" && !transfer ? "n" : "n dim"}>{amountCell(e)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pages > 1 ? (
        <nav className="pager" aria-label="分頁">
          {page > 1 ? <Link href={href(page - 1)}>◀ 前一頁</Link> : <span />}
          <span>
            第 {page}／{pages} 頁
          </span>
          {page < pages ? <Link href={href(page + 1)}>下一頁 ▶</Link> : <span />}
        </nav>
      ) : null}
    </SelectProvider>
  );
}
