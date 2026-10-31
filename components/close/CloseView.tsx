import Link from "next/link";
import type { AccountClose, BudgetClose } from "@/lib/domain/month-end";
import { closeState } from "@/lib/domain/month-end";
import { formatAmount, formatSigned } from "@/lib/money";
import { toKanji } from "@/lib/time";
import { CloseButton } from "./CloseButton";
import { ReconInline } from "./ReconInline";

type AccountRow = AccountClose & { recon: { date: string; diff: number } | null };

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

function Recon({ a, monthStart }: { a: AccountRow; monthStart: string }) {
  if (!a.recon || a.recon.date < monthStart) {
    return (
      <Link href={`/settings/accounts?a=${a.id}`}>
        本月未對帳{a.recon ? `（上次 ${md(a.recon.date)}）` : ""}
      </Link>
    );
  }
  return a.recon.diff === 0 ? <span>已對上　{md(a.recon.date)}</span> : (
    <Link href={`/settings/accounts?a=${a.id}`} className="bad">
      差 △{formatAmount(Math.abs(a.recon.diff))}　{md(a.recon.date)}
    </Link>
  );
}

export function CloseView({
  year,
  month,
  next,
  monthStart,
  monthEnd,
  today,
  accounts,
  budgets,
  otherCount,
}: {
  year: number;
  month: number;
  next: { year: number; month: number };
  monthStart: string;
  monthEnd: string;
  today: string;
  accounts: AccountRow[];
  budgets: BudgetClose[];
  otherCount: number;
}) {
  const sum = (f: (a: AccountRow) => number) => accounts.reduce((s, a) => s + f(a), 0);
  const unreconciled = accounts.filter((a) => !a.recon || a.recon.date < monthStart || a.recon.diff !== 0);
  const state = closeState(budgets);
  const reconDate = monthEnd < today ? monthEnd : today;
  const nextLabel = `${toKanji(next.month)}月`;
  return (
    <div className="mc">
      <div className="mc-col">
        <h2 className="sec">帳戶：月初 → 月末</h2>
        {accounts.length === 0 ? (
          <p className="r hint">還沒有帳戶。到「設定 → 帳戶・對帳」新增。</p>
        ) : (
          <table className="rt rp">
            <caption className="sr">{toKanji(month)}月各帳戶的月初餘額、收支、轉帳、月末餘額與對帳狀況</caption>
            <thead>
              <tr>
                <th scope="col">帳戶</th>
                <th scope="col" className="n">月初</th>
                <th scope="col" className="n c-a">收入</th>
                <th scope="col" className="n c-a">支出</th>
                <th scope="col" className="n c-a">轉帳</th>
                <th scope="col" className="n">月末</th>
                <th scope="col" className="c-r">對帳</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <th scope="row">{a.name}</th>
                  <td className="n">{formatSigned(a.open)}</td>
                  <td className="n c-a">{a.income === 0 ? "－" : formatAmount(a.income)}</td>
                  <td className="n c-a">{a.expense === 0 ? "－" : formatAmount(a.expense)}</td>
                  <td className="n c-a">{a.transfer === 0 ? "－" : formatSigned(a.transfer)}</td>
                  <td className="n"><b>{formatSigned(a.close)}</b></td>
                  <td className="c-r"><Recon a={a} monthStart={monthStart} /></td>
                </tr>
              ))}
              <tr className="sum">
                <th scope="row">合計</th>
                <td className="n">{formatSigned(sum((a) => a.open))}</td>
                <td className="n c-a">{formatAmount(sum((a) => a.income))}</td>
                <td className="n c-a">{formatAmount(sum((a) => a.expense))}</td>
                <td className="n c-a">{formatSigned(sum((a) => a.transfer))}</td>
                <td className="n">{formatSigned(sum((a) => a.close))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}

        <h2 className="sec">收尾前先看一眼</h2>
        {unreconciled.length > 0 ? (
          <>
            <h2 className="sec">對帳：{md(reconDate)}</h2>
            <ReconInline accounts={unreconciled.map((a) => ({ id: a.id, name: a.name, close: a.close }))} date={reconDate} />
          </>
        ) : null}
        <ul className="mc-todo">
          <li className={unreconciled.length === 0 ? "ok" : undefined}>
            {unreconciled.length === 0 ? "每個帳戶本月都對過、對上了" : `${unreconciled.length} 個帳戶還沒對上：${unreconciled.map((a) => a.name).join("、")}`}
          </li>
          <li className={otherCount === 0 ? "ok" : undefined}>
            {otherCount === 0 ? "本月沒有記在「其他」的支出" : (
              <>
                本月有 {otherCount} 筆支出記在「其他」，　
                <Link href={`/search?type=expense&main=${encodeURIComponent("其他")}&from=${monthStart}&to=${monthEnd}`}>看看能不能分到科目</Link>
              </>
            )}
          </li>
        </ul>
      </div>

      <div className="mc-col">
        <h2 className="sec">預算：剩下的帶到{nextLabel}</h2>
        {budgets.length === 0 ? (
          <p className="r hint">
            <span className="wrap">這個月沒有設定預算。到「預算」設定後，月底可以把剩下的（或超支的）帶到下個月。</span>
          </p>
        ) : (
          <>
            <table className="rt rp">
              <caption className="sr">{toKanji(month)}月各科目預算、支出、剩餘，以及{nextLabel}已帶入的金額</caption>
              <thead>
                <tr>
                  <th scope="col">科目</th>
                  <th scope="col" className="n">可用</th>
                  <th scope="col" className="n">支出</th>
                  <th scope="col" className="n">剩餘</th>
                  <th scope="col" className="n c-a">{nextLabel}已帶入</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.main}>
                    <th scope="row">{b.main}</th>
                    <td className="n">{formatAmount(b.available)}</td>
                    <td className="n">{b.spent === 0 ? "－" : formatAmount(b.spent)}</td>
                    <td className={b.remaining < 0 ? "n bad" : "n"}><b>{formatSigned(b.remaining)}</b></td>
                    <td className="n c-a dim">{b.nextRollover === null ? "尚無預算" : formatSigned(b.nextRollover)}</td>
                  </tr>
                ))}
                <tr className="sum">
                  <th scope="row">合計</th>
                  <td className="n">{formatAmount(budgets.reduce((s, b) => s + b.available, 0))}</td>
                  <td className="n">{formatAmount(budgets.reduce((s, b) => s + b.spent, 0))}</td>
                  <td className="n">{formatSigned(budgets.reduce((s, b) => s + b.remaining, 0))}</td>
                  <td className="c-a" />
                </tr>
              </tbody>
            </table>
            <p className="r hint">
              <span className="wrap">
                {state === "closed"
                  ? `${nextLabel}已經帶入這些金額。`
                  : state === "stale"
                    ? `${nextLabel}帶入的金額和現在算的不一樣：結轉之後這個月的帳目又改過。重按一次更新。`
                    : `還沒結轉到${nextLabel}。`}
                超支會帶成負數；{nextLabel}還沒有的預算會沿用本月金額。重按會用最新的帳目重算，不會疊加。
              </span>
            </p>
            <CloseButton year={year} month={month} closed={state !== "open"} nextLabel={nextLabel} />
          </>
        )}
      </div>
    </div>
  );
}
