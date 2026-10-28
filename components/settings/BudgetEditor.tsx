"use client";

import { useState } from "react";
import { clearBudget, copyLastMonthBudget, setBudget } from "@/app/actions/budget";
import { formatAmount } from "@/lib/money";

interface Row {
  main: string;
  amount: number | null;
  thresholdPct: number;
}

export function BudgetEditor({ year, month, rows, hasAny }: { year: number; month: number; rows: Row[]; hasAny: boolean }) {
  const [copyMsg, setCopyMsg] = useState("");
  return (
    <>
      {!hasAny ? (
        <div className="r">
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              const res = await copyLastMonthBudget({ year, month });
              setCopyMsg(res.ok ? "已沿用上月預算" : res.error);
            }}
          >
            沿用上月預算
          </button>
          <span aria-live="polite" className="note">
            {copyMsg}
          </span>
        </div>
      ) : null}
      <ul className="bud-list">
        {rows.map((r) => (
          <BudgetRow key={r.main} row={r} year={year} month={month} />
        ))}
      </ul>
    </>
  );
}

function BudgetRow({ row, year, month }: { row: Row; year: number; month: number }) {
  const [amount, setAmount] = useState(row.amount === null ? "" : String(row.amount));
  const [pct, setPct] = useState(String(row.thresholdPct));
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const id = `bud-${row.main}`;

  async function save() {
    const p = Number(pct);
    const res = await setBudget({ main_category: row.main, year, month, amount, warning_threshold: Number.isFinite(p) ? p / 100 : NaN });
    setBad(!res.ok);
    setMsg(res.ok ? "已儲存" : res.error);
  }
  async function clear() {
    const res = await clearBudget({ main_category: row.main, year, month });
    setBad(!res.ok);
    setMsg(res.ok ? "已清除" : res.error);
    if (res.ok) setAmount("");
  }

  return (
    <li className="bud">
      <div className="bud-h">
        <b>{row.main}</b>
        <span className="note">{row.amount === null ? "未設定" : `本月 ${formatAmount(row.amount)}`}</span>
      </div>
      <div className="bud-f">
        <label htmlFor={`${id}-a`} className="sr">
          {row.main} 預算金額
        </label>
        <input id={`${id}-a`} inputMode="decimal" autoComplete="off" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label htmlFor={`${id}-p`} className="sr">
          {row.main} 提醒比例 %
        </label>
        <input id={`${id}-p`} className="pct" inputMode="numeric" autoComplete="off" value={pct} onChange={(e) => setPct(e.target.value)} />
        <span aria-hidden="true">%</span>
        <button type="button" className="ghost" onClick={save}>
          儲存<span className="sr">：{row.main}</span>
        </button>
        {row.amount !== null ? (
          <button type="button" className="ghost" onClick={clear}>
            清除<span className="sr">：{row.main}</span>
          </button>
        ) : null}
      </div>
      <p className={bad ? "fld-err" : "note"} aria-live="polite">
        {msg}
      </p>
    </li>
  );
}
