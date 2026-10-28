import Link from "next/link";
import { DaySlider } from "@/components/today/DaySlider";
import { AlertRow } from "@/components/paper/AlertRow";
import { Block } from "@/components/paper/Block";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { TotalLine } from "@/components/paper/TotalLine";
import { subLabel } from "@/lib/domain/categories";
import type { Entry } from "@/lib/domain/types";
import { formatAmount, formatSigned, roundToTen } from "@/lib/money";
import { loadToday } from "@/lib/server/today";
import { dayOfMonth, toKanji, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

function amountCell(e: Entry): string {
  if (e.currency !== "TWD") return "未納入";
  return e.entry_type === "income" ? `＋${formatAmount(e.amount)}` : formatAmount(e.amount);
}

export default async function TodayPage() {
  const { view, today, year, month, accountNames } = await loadToday();
  const day = dayOfMonth(today);
  const name = (id: string | null) => (id ? (accountNames[id] ?? "—") : "—");
  const { budget } = view;

  return (
    <>
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

        {view.todayRows.length > 0 ? (
          <Block label="今日">
            <table className="ledger">
              <caption className="sr">今日明細</caption>
              <colgroup>
                <col style={{ width: 84 }} />
                <col />
                <col style={{ width: 52 }} />
                <col style={{ width: 62 }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">科目</th>
                  <th scope="col">摘要</th>
                  <th scope="col">帳戶</th>
                  <th scope="col" className="n">
                    金額
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.todayRows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.entry_type === "transfer" ? "轉帳" : `${e.main_category}／${subLabel(e.sub_category ?? "other")}`}
                    </td>
                    <td className="m">
                      <span className="clamp">{e.notes ?? ""}</span>
                    </td>
                    <td className="sm">
                      <span className="clamp">
                        {e.entry_type === "transfer" ? `${name(e.account_id)}→${name(e.transfer_account_id)}` : name(e.account_id)}
                      </span>
                    </td>
                    <td className="n">{amountCell(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        ) : (
          <Hint>今天還沒有帳目。按下方「記一筆」開始。</Hint>
        )}

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
        {view.alerts.length > 0 ? (
          view.alerts.map((a) => (
            <AlertRow
              key={a.kind + a.text}
              tone={["uncategorized", "duplicate", "abnormal", "missing-recurring"].includes(a.kind) ? "question" : "action"}
              href={a.href}
              actionLabel={a.actionLabel ?? "查看"}
            >
              <strong>{a.subject}</strong> {a.body}
              {a.emphasis ? (
                <>
                  {a.body ? " " : ""}
                  <span className="bad">{a.emphasis}</span>
                </>
              ) : null}
            </AlertRow>
          ))
        ) : (
          <Hint>目前沒有需要處理的事。</Hint>
        )}

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
    </>
  );
}
