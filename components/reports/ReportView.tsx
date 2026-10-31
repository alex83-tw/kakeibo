import Link from "next/link";
import { categoryBreakdown, change, dailyExpense, heatLevel, monthlyTotals, periodRange, previousPeriod, totals, trendMonths, ym, type Period } from "@/lib/domain/reports";
import type { Entry } from "@/lib/domain/types";
import { formatAmount, formatSigned } from "@/lib/money";
import { formatMonthParam, shiftMonth, toKanji, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

/** A search for what a number on this page adds up (every figure here can be traced to its entries). */
const searchHref = (p: { type?: string; main?: string; from: string; to: string }) => {
  const q = new URLSearchParams();
  if (p.type) q.set("type", p.type);
  if (p.main) q.set("main", p.main);
  q.set("from", p.from);
  q.set("to", p.to);
  return `/search?${q}`;
};

function Delta({ cur, prev, label, goodWhenDown = false }: { cur: number; prev: number; label: string; goodWhenDown?: boolean }) {
  const pct = change(cur, prev);
  if (pct === null) return null;
  const up = pct > 0;
  return (
    <span className={`note ${pct !== 0 && up !== goodWhenDown ? "worse" : ""}`}>
      {label} {pct === 0 ? "持平" : `${up ? "＋" : "－"}${Math.abs(pct)}%`}
    </span>
  );
}

export function ReportView({ period, entries, thisMonth }: { period: Period; entries: Entry[]; thisMonth: { year: number; month: number } }) {
  const range = periodRange(period);
  const prevPeriod = previousPeriod(period);
  const prevRange = periodRange(prevPeriod);
  const cur = totals(entries, range);
  const prev = totals(entries, prevRange);
  const rows = categoryBreakdown(entries, range, prevRange);
  const vs = period.kind === "month" ? "比上個月" : "比去年";
  const trend = monthlyTotals(entries, trendMonths(period));
  const trendMax = Math.max(1, ...trend.flatMap((t) => [t.income, t.expense]));
  const catMax = Math.max(1, ...rows.map((r) => r.amount));
  const empty = cur.income === 0 && cur.expense === 0;

  const monthHref = (y: number, m: number) => `/reports?m=${formatMonthParam(y, m)}`;
  const viewYear = period.year;
  const toMonth = period.kind === "month" ? { year: period.year, month: period.month } : viewYear === thisMonth.year ? thisMonth : { year: viewYear, month: 12 };
  const toYear = period.kind === "year" ? viewYear : period.year;

  return (
    <>
      <nav className="mnav rp-mode" aria-label="報表期間">
        <Link href={monthHref(toMonth.year, toMonth.month)} aria-current={period.kind === "month" ? "page" : undefined}>
          月
        </Link>
        <Link href={`/reports?y=${toYear}`} aria-current={period.kind === "year" ? "page" : undefined}>
          年
        </Link>
      </nav>
      {period.kind === "month" ? (
        <MonthStep year={period.year} month={period.month} />
      ) : (
        <nav className="mnav rp-year" aria-label="切換年份">
          <Link href={`/reports?y=${period.year - 1}`}>
            ◀ <span className="sr">前一年：</span>
            {period.year - 1}
          </Link>
          <span aria-current="date">{period.year} 年</span>
          <Link href={`/reports?y=${period.year + 1}`}>
            <span className="sr">後一年：</span>
            {period.year + 1} ▶
          </Link>
        </nav>
      )}

      {empty ? (
        <p className="r hint">這段期間還沒有帳目。</p>
      ) : (
        <div className="rp-grid">
          <div className="rp-col">
          <h2 className="sec">收支</h2>
          <div className="r">
            <span>收入</span>
            <span>
              <Delta cur={cur.income} prev={prev.income} label={vs} goodWhenDown={false} /> <b>{formatAmount(cur.income)}</b>
            </span>
          </div>
          <div className="r">
            <span>支出</span>
            <span>
              <Delta cur={cur.expense} prev={prev.expense} label={vs} goodWhenDown /> <b>{formatAmount(cur.expense)}</b>
            </span>
          </div>
          <div className="r rp-net">
            <span>淨額</span>
            <b>{formatSigned(cur.net)}</b>
          </div>

          <h2 className="sec">科目占比（支出）</h2>
          {rows.length === 0 ? (
            <p className="r hint">這段期間沒有支出。</p>
          ) : (
            <table className="rt rp rp-cat">
              <caption className="sr">支出依科目，由多到少；點科目看明細</caption>
              <thead>
                <tr>
                  <th>科目</th>
                  <th className="n">金額</th>
                  <th className="n">占比</th>
                  <th className="n c-a">{vs}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = change(r.amount, r.prev);
                  return (
                    <tr key={r.main} style={{ "--w": `${Math.max(2, Math.round((r.amount / catMax) * 100))}%` } as React.CSSProperties}>
                      <td>
                        <Link href={searchHref({ type: "expense", main: r.main, from: range.start, to: range.end })}>{r.main}</Link>
                      </td>
                      <td className="n">{formatAmount(r.amount)}</td>
                      <td className="n">{r.share}%</td>
                      <td className="n c-a">{pct === null ? "—" : pct === 0 ? "持平" : `${pct > 0 ? "＋" : "－"}${Math.abs(pct)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          </div>
          <div className="rp-col">
          <h2 className="sec">{period.kind === "month" ? "近六個月" : "每月"}</h2>
          <table className="rt rp rp-trend">
            <caption className="sr">每月收入與支出；上方斜紋是收入，下方實心是支出</caption>
            <thead>
              <tr>
                <th>月</th>
                <th className="n">收入</th>
                <th className="n">支出</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t) => {
                const isCur = period.kind === "month" ? t.month === ym(period.year, period.month) : false;
                return (
                  <tr
                    key={t.month}
                    className={isCur ? "now" : undefined}
                    style={{ "--wi": `${Math.round((t.income / trendMax) * 100)}%`, "--we": `${Math.round((t.expense / trendMax) * 100)}%` } as React.CSSProperties}
                  >
                    <td>
                      <Link href={monthHref(Number(t.month.slice(0, 4)), Number(t.month.slice(5)))}>
                        {Number(t.month.slice(5))}月
                      </Link>
                    </td>
                    <td className="n">{t.income === 0 ? "—" : formatAmount(t.income)}</td>
                    <td className="n">{t.expense === 0 ? "—" : formatAmount(t.expense)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {period.kind === "month" ? <Heat entries={entries} year={period.year} month={period.month} /> : null}
          </div>
        </div>
      )}
    </>
  );
}

function MonthStep({ year, month }: { year: number; month: number }) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  return (
    <nav className="mnav rp-step" aria-label="切換月份">
      <Link href={`/reports?m=${formatMonthParam(prev.year, prev.month)}`}>
        ◀ <span className="sr">上個月：</span>
        {toKanji(prev.month)}月
      </Link>
      <span aria-current="date">
        {year} 年 {toKanji(month)}月
      </span>
      <Link href={`/reports?m=${formatMonthParam(next.year, next.month)}`}>
        <span className="sr">下個月：</span>
        {toKanji(next.month)}月 ▶
      </Link>
    </nav>
  );
}

/** A month as a calendar; each day is shaded by its spending relative to the month's heaviest day, and opens that day's entries. */
function Heat({ entries, year, month }: { entries: Entry[]; year: number; month: number }) {
  const daily = dailyExpense(entries, year, month);
  const max = Math.max(0, ...daily);
  const lead = weekdayIndex(`${ym(year, month)}-01`);
  if (max === 0) return null;
  return (
    <>
      <h2 className="sec">每日支出</h2>
      <div className="rp-heat" role="group" aria-label="每日支出，顏色愈深花得愈多">
        {WEEKDAY_JP.map((w) => (
          <span key={w} className="wk" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {daily.map((amount, i) => {
          const d = `${ym(year, month)}-${String(i + 1).padStart(2, "0")}`;
          return amount > 0 ? (
            <Link key={d} href={searchHref({ type: "expense", from: d, to: d })} className={`lv${heatLevel(amount, max)}`} aria-label={`${month}月${i + 1}日 支出 ${formatAmount(amount)}`}>
              {i + 1}
            </Link>
          ) : (
            <span key={d} className="lv0">
              {i + 1}
            </span>
          );
        })}
      </div>
      <p className="r hint">
        <span className="wrap">最多的一天 {formatAmount(max)}。點日期看當天的帳目。</span>
      </p>
    </>
  );
}
