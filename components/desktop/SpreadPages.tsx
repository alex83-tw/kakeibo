import Link from "next/link";
import { LedgerBook } from "@/components/ledger/LedgerBook";
import { AlertList } from "@/components/paper/AlertList";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { TotalLine } from "@/components/paper/TotalLine";
import { ReconTable } from "@/components/recon/ReconTable";
import { TodayBlock } from "@/components/today/TodayBlock";
import { dailyExpenses } from "@/lib/domain/balances";
import { buildLedger } from "@/lib/domain/ledger";
import { buildRecon } from "@/lib/domain/recon";
import type { TodayView } from "@/lib/domain/today";
import type { Entry, LedgerAccount } from "@/lib/domain/types";
import type { ReconciliationRecord } from "@/lib/domain/recon";
import { formatAmount, formatSigned } from "@/lib/money";
import { dayOfMonth, monthRange, toKanji, WEEKDAY_JP, weekdayIndex } from "@/lib/time";
import { BudgetTable } from "./BudgetTable";

interface Data {
  view: TodayView;
  today: string;
  year: number;
  month: number;
  accountNames: Record<string, string>;
  raw: { accounts: LedgerAccount[]; entries: Entry[]; reconciliations: ReconciliationRecord[] };
}

/** Left page: this month's ledger with the daily trend. Built from the same entries as 今日. */
export function LeftPage({ data }: { data: Data }) {
  const { year, month, today, raw } = data;
  const range = monthRange(year, month);
  const entries = raw.entries.filter((e) => e.entry_date >= range.start && e.entry_date <= range.end);
  const ledger = buildLedger({ year, month, entries, today });
  const daily = dailyExpenses(entries, range);
  const top = daily.reduce((best, v, i) => (v > daily[best] ? i : best), 0);
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
        <div className="r kv">
          <span>每日支出</span>
          <span className="dim">{daily[top] > 0 ? `最高 ${toKanji(top + 1)}日 ${formatAmount(daily[top])}` : "本月還沒有支出"}</span>
        </div>
        <div className="days static" role="img" aria-label={`${toKanji(month)}月每日支出長條圖`} style={{ gridTemplateColumns: `repeat(${daily.length}, 1fr)` }}>
          {daily.map((v, i) => (
            <i key={i} className={i + 1 === dayOfMonth(today) ? "t" : undefined} style={{ height: `${Math.max(3, (v / Math.max(1, daily[top])) * 100)}%` }} />
          ))}
        </div>
        <div className="dayscale">
          <span>1日</span>
          <span>{daily.length}日</span>
        </div>
        <Link className="act pg-more" href="/ledger">
          看其他月份
        </Link>
        <LedgerBook ledger={ledger} year={year} month={month} />
        <div className="gap" />
      </div>
    </>
  );
}

/** Right page: 今日, 預算, 注意, 對帳. */
export function RightPage({ data }: { data: Data }) {
  const { view, today, month, accountNames, raw } = data;
  const day = dayOfMonth(today);
  const recon = buildRecon({ accounts: raw.accounts, entries: raw.entries.filter((e) => e.entry_date <= today), reconciliations: raw.reconciliations });
  return (
    <>
      <Run label={`${toKanji(month)}月　今日・預算・對帳`} />
      <div className="rows">
        <section id="p-today">
          <Head
            month={month}
            title={
              <>
                {toKanji(day)}日
                <span className="wd">
                  {WEEKDAY_JP[weekdayIndex(today)]}曜<span className="sr">，{toKanji(month)}月</span>
                </span>
              </>
            }
            aside={
              view.accounts.length > 0 ? (
                <span className="sub">
                  帳戶合計
                  <br />
                  <b>{formatSigned(view.totalBalance)}</b>
                </span>
              ) : null
            }
          />
          <TotalLine label="今日支出合計" amount={view.todayExpense} />
          <TodayBlock rows={view.todayRows} accountNames={accountNames} />
        </section>

        <section id="p-budget">
          <div className="gap" />
          <h2 className="sec">本月預算</h2>
          {view.budgetRows.length > 0 ? (
            <BudgetTable rows={view.budgetRows} />
          ) : (
            <Hint>
              還沒設定本月預算。<Link href="/settings/budget">到設定建立</Link>
            </Hint>
          )}
        </section>

        <div className="gap" />
        <h2 className="sec">注意</h2>
        <AlertList alerts={view.alerts} />

        <section id="p-recon">
          <div className="gap" />
          <h2 className="sec">對帳</h2>
          {recon.rows.length > 0 ? (
            <>
              <ReconTable recon={recon} />
              <Link className="act pg-more" href="/recon">
                輸入帳單餘額
              </Link>
            </>
          ) : (
            <Hint>
              還沒有帳戶，<Link href="/settings/accounts">先到設定建立</Link>。
            </Hint>
          )}
        </section>
        <div className="gap" />
      </div>
    </>
  );
}
