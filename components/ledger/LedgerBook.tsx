import Link from "next/link";
import { Fragment } from "react";
import { Block } from "@/components/paper/Block";
import { Hint } from "@/components/paper/Hint";
import type { LedgerView } from "@/lib/domain/ledger";
import { formatAmount } from "@/lib/money";
import { toKanji, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

/** The month's day-by-day table with weekly and month totals; each day links to its detail page. */
export function LedgerBook({ ledger, year, month }: { ledger: LedgerView; year: number; month: number }) {
  const date = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return (
    <>
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
    </>
  );
}
