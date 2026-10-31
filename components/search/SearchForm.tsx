import Link from "next/link";
import { describeFilters, SORTS, type SearchFilters, type SearchSort } from "@/lib/domain/search";

const SORT_LABEL: Record<SearchSort, string> = {
  "date-desc": "日期：新到舊",
  "date-asc": "日期：舊到新",
  "amount-desc": "金額：大到小",
  "amount-asc": "金額：小到大",
};

/**
 * A plain GET form: the URL is the state, so there is nothing to hydrate and the result can be shared or reloaded.
 * Open when nothing is filtered yet; once there is a search it folds to one line saying what it is.
 */
export function SearchForm({ f, expenseMains, incomeMains }: { f: SearchFilters; expenseMains: string[]; incomeMains: string[] }) {
  const summary = describeFilters(f);
  const known = new Set([...expenseMains, ...incomeMains]);
  return (
    <details className="sf" open={summary === ""}>
      <summary>{summary === "" ? "搜尋條件" : `搜尋條件：${summary}`}</summary>
      <form method="get" action="/search" className="form-block">
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="s-q">關鍵字</label>
            <input id="s-q" name="q" type="search" defaultValue={f.q} placeholder="科目、摘要、帳戶" autoComplete="off" />
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="s-type">類型</label>
            <select id="s-type" name="type" defaultValue={f.type}>
              <option value="">全部</option>
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="transfer">轉帳</option>
            </select>
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="s-main">科目</label>
            <select id="s-main" name="main" defaultValue={f.main}>
              <option value="">全部</option>
              {f.main !== "" && !known.has(f.main) ? <option value={f.main}>{f.main}</option> : null}
              <optgroup label="支出">
                {expenseMains.map((m) => (
                  <option key={`e-${m}`} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
              <optgroup label="收入">
                {incomeMains.map((m) => (
                  <option key={`i-${m}`} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="s-from">日期</label>
            <input id="s-from" name="from" type="date" defaultValue={f.from} aria-label="開始日期" />
            <span aria-hidden="true">～</span>
            <input id="s-to" name="to" type="date" defaultValue={f.to} aria-label="結束日期" />
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="s-min">金額</label>
            <input id="s-min" name="min" inputMode="decimal" defaultValue={f.min ?? ""} placeholder="最少" aria-label="最少金額" autoComplete="off" />
            <span aria-hidden="true">～</span>
            <input id="s-max" name="max" inputMode="decimal" defaultValue={f.max ?? ""} placeholder="最多" aria-label="最多金額" autoComplete="off" />
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="s-sort">排序</label>
            <select id="s-sort" name="sort" defaultValue={f.sort}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="sf-go">
          <button type="submit" className="btn">
            搜尋
          </button>
          <Link className="act" href="/search">
            清除條件
          </Link>
        </div>
      </form>
    </details>
  );
}
