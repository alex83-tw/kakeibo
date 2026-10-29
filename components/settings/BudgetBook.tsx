"use client";

import { useEffect, useRef, useState } from "react";
import { clearBudget, copyLastMonthBudget, setBudget } from "@/app/actions/budget";
import { Block } from "@/components/paper/Block";
import { formatAmount, formatSigned } from "@/lib/money";

export interface BudgetBookRow {
  main: string;
  /** null = no budget set this month */
  amount: number | null;
  /** budget plus rollover; what 餘額 is measured against */
  available: number;
  spent: number;
  thresholdPct: number;
}

/**
 * 預算帳頁：一科目一行，金額就地改、離開欄位就存；清空＝取消這項預算。
 * 本月有支出但還沒預算的科目也列在這裡，所以「已用」永遠對得上帳本。
 */
export function BudgetBook({ year, month, rows, addable, hasAny }: { year: number; month: number; rows: BudgetBookRow[]; addable: string[]; hasAny: boolean }) {
  const [extra, setExtra] = useState<string[]>([]);
  const [status, setStatus] = useState<{ text: string; bad: boolean }>({ text: "", bad: false });
  const [copyMsg, setCopyMsg] = useState("");
  const [focusMain, setFocusMain] = useState<string | null>(null);
  const shown: BudgetBookRow[] = [...rows, ...extra.filter((m) => !rows.some((r) => r.main === m)).map((main) => ({ main, amount: null, available: 0, spent: 0, thresholdPct: 80 }))];
  const left = addable.filter((m) => !extra.includes(m));

  useEffect(() => {
    if (focusMain) document.getElementById(`bud-${focusMain}-a`)?.focus();
  }, [focusMain]);

  const budgeted = shown.filter((r) => r.amount !== null);
  const totalBudget = budgeted.reduce((s, r) => s + r.available, 0);
  const totalSpent = shown.reduce((s, r) => s + r.spent, 0);
  const remaining = totalBudget - budgeted.reduce((s, r) => s + r.spent, 0);

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
      <Block label="預算">
        <table className="ledger bb">
          <caption className="sr">各主分類本月預算、已用、餘額；預算與提醒比例可直接修改</caption>
          <colgroup>
            <col style={{ width: 68 }} />
            <col />
            <col style={{ width: 56 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 46 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">科目</th>
              <th scope="col" className="n">預算</th>
              <th scope="col" className="n">已用</th>
              <th scope="col" className="n">餘額</th>
              <th scope="col" className="n tight">提醒%</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Line key={r.main} row={r} year={year} month={month} report={(text, bad) => setStatus({ text, bad })} />
            ))}
            <tr className="sum">
              <th scope="row">合計</th>
              <td className="n">{formatAmount(totalBudget)}</td>
              <td className="n">{formatAmount(totalSpent)}</td>
              <td className={remaining < 0 ? "n bad" : "n"}>{formatSigned(remaining)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </Block>
      <p className={status.bad ? "fld-err bb-live" : "note bb-live"} aria-live="polite">
        {status.text}
      </p>
      {left.length > 0 ? (
        <div className="chkrow">
          <label htmlFor="bud-add">加入科目</label>
          <select
            id="bud-add"
            value=""
            onChange={(e) => {
              const main = e.target.value;
              if (!main) return;
              setExtra((x) => [...x, main]);
              setFocusMain(main);
            }}
          >
            <option value="">選擇要設預算的科目</option>
            {left.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}

function Line({ row, year, month, report }: { row: BudgetBookRow; year: number; month: number; report: (text: string, bad: boolean) => void }) {
  const saved = row.amount === null ? "" : String(row.amount);
  const [amount, setAmount] = useState(saved);
  const [pct, setPct] = useState(String(row.thresholdPct));
  const [bad, setBad] = useState(false);
  const pending = useRef(false);
  const id = `bud-${row.main}`;

  async function commit() {
    if (pending.current) return;
    const trimmed = amount.trim();
    if (trimmed === saved && Number(pct) === row.thresholdPct) return;
    pending.current = true;
    const p = Number(pct);
    const res =
      trimmed === ""
        ? row.amount === null
          ? { ok: true as const }
          : await clearBudget({ main_category: row.main, year, month })
        : await setBudget({ main_category: row.main, year, month, amount: trimmed, warning_threshold: Number.isFinite(p) ? p / 100 : NaN });
    pending.current = false;
    setBad(!res.ok);
    report(res.ok ? (trimmed === "" ? `${row.main}：已取消預算` : `${row.main}：已儲存`) : `${row.main}：${res.error}`, !res.ok);
  }

  const remaining = row.amount === null ? null : row.available - row.spent;
  return (
    <tr>
      <th scope="row">{row.main}</th>
      <td className="n in">
        <label htmlFor={`${id}-a`} className="sr">
          {row.main} 預算金額
        </label>
        <input id={`${id}-a`} inputMode="decimal" autoComplete="off" placeholder="未設" value={amount} aria-invalid={bad || undefined} onChange={(e) => setAmount(e.target.value)} onBlur={commit} />
      </td>
      <td className={row.spent > 0 ? "n" : "n dim"}>{row.spent > 0 ? formatAmount(row.spent) : "－"}</td>
      <td className={remaining !== null && remaining < 0 ? "n bad" : "n dim"}>{remaining === null ? "－" : formatSigned(remaining)}</td>
      <td className="n in">
        <label htmlFor={`${id}-p`} className="sr">
          {row.main} 提醒比例（用到幾成時提醒，%）
        </label>
        <input id={`${id}-p`} inputMode="numeric" autoComplete="off" value={pct} onChange={(e) => setPct(e.target.value)} onBlur={commit} />
      </td>
    </tr>
  );
}
