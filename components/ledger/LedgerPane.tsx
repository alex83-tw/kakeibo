import { Fragment } from "react";
import { Head } from "@/components/paper/Head";
import { MonthNav } from "@/components/paper/MonthNav";
import { NegNote } from "@/components/paper/NegNote";
import { Run } from "@/components/paper/Run";
import { buildLedger, type LedgerLine } from "@/lib/domain/ledger";
import { formatAmount, formatSigned } from "@/lib/money";
import { loadLedgerMonth } from "@/lib/server/ledger";
import { currentMonth, formatMonthParam, toKanji, twToday, WEEKDAY_JP, weekdayIndex } from "@/lib/time";
import { LedgerTools } from "./LedgerTools";
import { LineButton } from "./LineButton";
import { SelectBar, SelectProvider } from "./SelectMode";

/**
 * 帳本：一筆一行寫在橫線上，欄線印到頁底。日期只寫在當天第一行；週計、月計之後畫實線與雙線。
 * 窄的頁面（手機）把摘要併在科目格、不顯示帳戶欄（container query）。
 */
export async function LedgerPane({ year, month, path }: { year: number; month: number; path: string }) {
  const { entries, accountNames, opening } = await loadLedgerMonth(year, month);
  const today = twToday();
  const ledger = buildLedger({ year, month, entries, today, opening });
  const monthKey = formatMonthParam(year, month);
  const cur = currentMonth();
  const date = (day: number) => `${monthKey}-${String(day).padStart(2, "0")}`;
  const account = (l: LedgerLine) => {
    const e = l.entry;
    if (!e) return "";
    const name = (id: string | null) => (id ? (accountNames[id] ?? "") : "");
    return l.transfer ? `${name(e.account_id)}→${name(e.transfer_account_id)}` : name(e.account_id);
  };
  const showAccounts = ledger.weeks.some((w) => w.lines.some((l) => account(l) !== ""));
  const amount = (n: number) => (n === 0 ? "" : formatSigned(n)); // a refund is a negative expense

  return (
    <SelectProvider key={monthKey}>
    <div className="lg">
      <Run label={`${toKanji(month)}月　帳本`} />
      <Head
        level={2}
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
      <MonthNav year={year} month={month} path={path} />
      <LedgerTools monthKey={monthKey} currentKey={formatMonthParam(cur.year, cur.month)} todayId={`d-${today.slice(8, 10)}`} path={path} />
      <SelectBar />

      <div className={showAccounts ? "lg-sheet" : "lg-sheet no-a"}>
        <table className="lg-t">
          <caption className="sr">{toKanji(month)}月帳目，一筆一行；點一行可以修改或刪除</caption>
          <colgroup>
            <col className="c-d" />
            <col className="c-c" />
            <col className="c-x" />
            <col className="c-a" />
            <col className="c-n" />
            <col className="c-n" />
            <col className="c-b" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">日</th>
              <th scope="col">科目</th>
              <th scope="col" className="c-x">
                摘要
              </th>
              <th scope="col" className="c-a">
                帳戶
              </th>
              <th scope="col" className="n">
                收入
              </th>
              <th scope="col" className="n">
                支出
              </th>
              <th scope="col" className="n c-b">
                餘額
              </th>
            </tr>
          </thead>
          <tbody>
            {ledger.weeks.map((w) => (
              <Fragment key={w.start}>
                {w.lines.map((l, i) => {
                  const e = l.entry;
                  const dim = l.transfer || l.foreign;
                  const note = [l.det, l.orig].filter(Boolean).join("　");
                  const muted = l.transfer ? `(${formatAmount(e!.amount)})` : "未納入";
                  return (
                    <tr key={e?.id ?? `t${l.day}`} data-q={`${l.cat} ${note} ${account(l)}`.toLowerCase()} id={l.first ? `d-${String(l.day).padStart(2, "0")}` : undefined} className={[l.isToday ? "today" : "", l.first && i > 0 ? "nd" : ""].join(" ").trim() || undefined}>
                      <td className="d" data-d={l.day}>
                        {l.first ? (
                          l.isToday ? (
                            <span className="dayno">
                              {l.day}
                              <span className="sr"> 今日</span>
                            </span>
                          ) : (
                            <>
                              {l.day} <span className="dim">{WEEKDAY_JP[weekdayIndex(date(l.day))]}</span>
                            </>
                          )
                        ) : null}
                      </td>
                      <td className="c">
                        {e ? (
                          <LineButton entry={e}>
                            <b>{l.cat}</b>
                            {note || account(l) ? <span className="x-in"> {[account(l), note].filter(Boolean).join("　")}</span> : null}
                            <span className="sr">
                              ，{l.day}日{l.income > 0 ? `收入 ${formatAmount(l.income)}` : l.expense > 0 ? `支出 ${formatAmount(l.expense)}` : dim ? muted : ""}，修改或刪除
                            </span>
                          </LineButton>
                        ) : (
                          <span className="dim">今日還沒有帳目</span>
                        )}
                      </td>
                      <td className="c-x dim">{note}</td>
                      <td className="c-a dim">{account(l)}</td>
                      <td className="n">{dim && e?.entry_type === "income" ? <span className="dim">{muted}</span> : amount(l.income)}</td>
                      <td className="n">{dim && e?.entry_type !== "income" && e ? <span className="dim">{muted}</span> : amount(l.expense)}</td>
                      <td className="n c-b dim">{l.balance === null ? "" : formatSigned(l.balance)}</td>
                    </tr>
                  );
                })}
                <tr className="wk">
                  <td colSpan={2}>
                    週計 {toKanji(w.start)}至{toKanji(w.end)}
                  </td>
                  <td className="c-x" />
                  <td className="c-a" />
                  <td className="n">{formatAmount(w.income)}</td>
                  <td className="n">{formatAmount(w.expense)}</td>
                  <td className="n c-b">{w.balance === null ? "" : formatSigned(w.balance)}</td>
                </tr>
                {w.balance === null ? null : (
                  <tr className="wk-b">
                    <td colSpan={4}>週末餘額　{formatSigned(w.balance)}</td>
                  </tr>
                )}
              </Fragment>
            ))}
            <tr className="sum">
              <td colSpan={2}>本月累計</td>
              <td className="c-x" />
              <td className="c-a" />
              <td className="n">{formatAmount(ledger.income)}</td>
              <td className="n">{formatAmount(ledger.expense)}</td>
              <td className="n c-b">{ledger.closing === null ? "" : formatSigned(ledger.closing)}</td>
            </tr>
            {ledger.closing === null ? null : (
              <tr className="sum-b">
                <td colSpan={4}>月末餘額　{formatSigned(ledger.closing)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {ledger.weeks.length === 0 ? <p className="lg-empty">這個月還沒有帳目。按「記一筆」開始。</p> : null}
      </div>
      <NegNote />
    </div>
    </SelectProvider>
  );
}
