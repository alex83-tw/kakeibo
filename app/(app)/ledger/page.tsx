import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Block } from "@/components/paper/Block";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { buildLedger } from "@/lib/domain/ledger";
import { formatAmount } from "@/lib/money";
import { getUserId } from "@/lib/server/auth";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, monthRange, parseMonthParam, shiftMonth, toKanji, twToday, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const target = m === undefined ? currentMonth() : parseMonthParam(m);
  if (!target) notFound();
  const { year, month } = target;

  const today = twToday();
  const range = monthRange(year, month);
  const entries = await listEntries(await createServerClient(), await getUserId(), range);
  const ledger = buildLedger({ year, month, entries, today });
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const date = (day: number) => `${ym(year, month)}-${String(day).padStart(2, "0")}`;

  return (
    <>
      <Run label={`${toKanji(month)}月　帳本`} />
      <div className="rows">
        <Head
          month={month}
          title="帳本"
          aside={
            <span className="sub">
              收入 {formatAmount(ledger.income)}　支出 {formatAmount(ledger.expense)}
              <br />
              淨額 {ledger.net < 0 ? "△" : "＋"}
              {formatAmount(ledger.net)}
            </span>
          }
        />
        <nav className="mnav" aria-label="切換月份">
          <Link href={`/ledger?m=${ym(prev.year, prev.month)}`}>
            ◀ <span className="sr">上個月：</span>
            {toKanji(prev.month)}月
          </Link>
          <span aria-current="date">
            {year} 年 {toKanji(month)}月
          </span>
          <Link href={`/ledger?m=${ym(next.year, next.month)}`}>
            <span className="sr">下個月：</span>
            {toKanji(next.month)}月 ▶
          </Link>
        </nav>

        {ledger.weeks.length === 0 ? (
          <Hint>這個月還沒有帳目。按下方「記一筆」開始。</Hint>
        ) : (
          <Block label="帳本">
            <table className="ledger">
              <caption className="sr">{toKanji(month)}月每日收支</caption>
              <colgroup>
                <col style={{ width: 46 }} />
                <col />
                <col style={{ width: 62 }} />
                <col style={{ width: 62 }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">日</th>
                  <th scope="col">科目・摘要</th>
                  <th scope="col" className="n">
                    收入
                  </th>
                  <th scope="col" className="n">
                    支出
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledger.weeks.map((w) => (
                  <Fragment key={w.start}>
                    {w.rows.map((r) => (
                      <tr key={r.day} className={r.isToday ? "today" : undefined}>
                        <td className="d">
                          <Link className="dlink" href={`/ledger/${date(r.day)}`}>
                            {r.isToday ? (
                              <span className="dayno">
                                {r.day}
                                <span className="sr"> 今日</span>
                              </span>
                            ) : (
                              <>
                                {r.day} <span className="dim">{WEEKDAY_JP[weekdayIndex(date(r.day))]}</span>
                              </>
                            )}
                            <span className="sr">，看這天的明細</span>
                          </Link>
                        </td>
                        <td className="m">
                          <span className="clamp">
                            <span className="cat">{r.cat}</span>
                            <span className="det">
                              {r.det}
                              {r.excluded ? "　含未納入" : ""}
                            </span>
                          </span>
                        </td>
                        <td className={r.income > 0 ? "n" : "n dim"}>{r.income > 0 ? formatAmount(r.income) : "－"}</td>
                        <td className={r.expense > 0 ? "n" : "n dim"}>{r.expense > 0 ? formatAmount(r.expense) : "－"}</td>
                      </tr>
                    ))}
                    <tr className="wk">
                      <td colSpan={2}>
                        週計　{toKanji(w.start)}至{toKanji(w.end)}日
                      </td>
                      <td className="n">{formatAmount(w.income)}</td>
                      <td className="n">{formatAmount(w.expense)}</td>
                    </tr>
                  </Fragment>
                ))}
                <tr className="sum">
                  <td colSpan={2}>本月累計</td>
                  <td className="n">{formatAmount(ledger.income)}</td>
                  <td className="n">{formatAmount(ledger.expense)}</td>
                </tr>
              </tbody>
            </table>
          </Block>
        )}
        <div className="gap" />
      </div>
    </>
  );
}
