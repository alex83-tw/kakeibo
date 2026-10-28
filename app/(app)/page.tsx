import Link from "next/link";
import { Spread } from "@/components/desktop/Spread";
import { LeftPage, RightPage } from "@/components/desktop/SpreadPages";
import { DaySlider } from "@/components/today/DaySlider";
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
  const data = await loadToday();
  const { view, today, year, month, accountNames } = data;
  const day = dayOfMonth(today);
  const { budget } = view;

  return (
    <Spread left={<LeftPage data={data} />} right={<RightPage data={data} />}>
      <Run label={`${toKanji(month)}月　今日`} />
      <div className="rows">
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

        <div className="gap" />
        <h2 className="sec">本月預算</h2>
        {budget ? (
          <>
            <div className="r kv">
              <span>
                已用 <b>{budget.percent}%</b>
              </span>
              <span>
                {formatAmount(budget.spent)} ／ 預算 {formatAmount(budget.available)}
              </span>
            </div>
          </>
        ) : (
          <Hint>
            還沒設定本月預算。<Link href="/settings">到設定建立</Link>
          </Hint>
        )}
        <DaySlider amounts={view.daily} today={day} year={year} month={month} />
        {budget ? (
          <div className="r kv">
            <span>預估月底</span>
            <span>
              <b>{formatAmount(roundToTen(budget.projected))}</b>　
              {budget.overall === "ok" ? "整體仍在預算內" : budget.overall === "over" ? <span className="bad">已超出預算</span> : <span className="bad">預估超出預算</span>}
            </span>
          </div>
        ) : null}

        <div className="gap" />
        <h2 className="sec">注意</h2>
        <AlertList alerts={view.alerts} />

        <div className="gap" />
        <h2 className="sec" id="acct">
          帳戶
        </h2>
        {view.accounts.length > 0 ? (
          <div className="acct">
            {view.accounts.map((a) => (
              <div key={a.id}>
                <span>{a.name}</span>
                <span>{formatSigned(a.balance)}</span>
              </div>
            ))}
            <div className="tot">
              <span>帳戶合計</span>
              <b>{formatSigned(view.totalBalance)}</b>
            </div>
          </div>
        ) : (
          <Hint>
            還沒有帳戶，<Link href="/settings">先到設定建立</Link>。
          </Hint>
        )}
        <div className="gap" />
      </div>
    </Spread>
  );
}
