import Link from "next/link";
import { DaySlider } from "@/components/today/DaySlider";
import { FirstAccount } from "@/components/today/FirstAccount";
import { TodayBlock } from "@/components/today/TodayBlock";
import { AlertList } from "@/components/paper/AlertList";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { TotalLine } from "@/components/paper/TotalLine";
import { formatAmount, formatSigned, roundToTen } from "@/lib/money";
import { loadToday } from "@/lib/server/today";
import { dayOfMonth, toKanji, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

export default async function TodayPage() {
  const { view, today, year, month, accountNames } = await loadToday();
  const day = dayOfMonth(today);
  const { budget, unbudgeted } = view;

  return (
    <>
      <Run label={`${toKanji(month)}月　今日`} />
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
            <a className="acctlink" href="#acct">
              <span>帳戶合計</span>
              <b>{formatSigned(view.totalBalance)}</b>
            </a>
          ) : null
        }
      />

      <TotalLine label="今日支出合計" amount={view.todayExpense} />
      <TodayBlock rows={view.todayRows} accountNames={accountNames} />

      <h2 className="sec">本月預算</h2>
      {budget ? (
        <div className="r">
          <span>
            {budget.spent > budget.available ? (
              <b className="bad">超支 {formatAmount(budget.spent - budget.available)}</b>
            ) : (
              <>
                已用 <b>{budget.percent}%</b>
              </>
            )}
          </span>
          <span>
            {formatAmount(budget.spent)} ／ 預算 {formatAmount(budget.available)}
          </span>
        </div>
      ) : (
        <Hint>
          還沒設定本月預算。<Link href="/budget">設定預算</Link>
        </Hint>
      )}
      {unbudgeted.total > 0 ? (
        <div className="r">
          <span>
            未設預算的支出 <b>{formatAmount(unbudgeted.total)}</b>
          </span>
          <Link className="act" href="/budget">
            看預算
          </Link>
        </div>
      ) : null}
      {budget ? (
        <div className="r">
          <span>預估月底</span>
          <span>
            <b>{formatAmount(roundToTen(budget.projected))}</b>　
            {budget.overall === "ok" ? (unbudgeted.total > 0 ? "已設預算的科目仍在預算內" : "整體仍在預算內") : budget.overall === "over" ? <span className="bad">已超出預算</span> : <span className="bad">預估超出預算</span>}
          </span>
        </div>
      ) : null}
      <DaySlider amounts={view.daily} today={day} year={year} month={month} />

      <h2 className="sec">注意</h2>
      <AlertList alerts={view.alerts} monthCloseDue={view.monthCloseDue} month={month} />

      <h2 className="sec" id="acct">
        帳戶
      </h2>
      {view.accounts.length > 0 ? (
        <table className="rt">
          <caption className="sr">各帳戶餘額</caption>
          <tbody>
            {view.accounts.map((a) => (
              <tr key={a.id}>
                <th scope="row">{a.name}</th>
                <td className="n">{formatSigned(a.balance)}</td>
              </tr>
            ))}
            <tr className="sum">
              <th scope="row">帳戶合計</th>
              <td className="n">{formatSigned(view.totalBalance)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <FirstAccount today={today} />
      )}
    </>
  );
}
