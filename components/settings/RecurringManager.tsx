"use client";

import { useState } from "react";
import { createRecurring, removeRecurring, toggleRecurring } from "@/app/actions/recurring";
import { CategoryPick, type PickKind } from "./CategoryPick";

export interface RecurringItem {
  id: string;
  name: string;
  category: string;
  amount: string;
  schedule: string;
  active: boolean;
}

export function RecurringManager({ items }: { items: RecurringItem[] }) {
  const [label, setLabel] = useState("");
  const [pick, setPick] = useState<{ kind: PickKind; main: string; sub: string }>({ kind: "expense", main: "", sub: "other" });
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [day, setDay] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function create() {
    setMsg("");
    const res = await createRecurring({ label, entry_type: pick.kind, main_category: pick.main, sub_category: pick.sub, amount_min: min, amount_max: max, due_day: day });
    if (!res.ok) return setErrors(res.errors as Record<string, string>);
    setErrors({});
    setLabel("");
    setMin("");
    setMax("");
    setDay("");
    setMsg("已新增週期帳目");
  }

  return (
    <>
      {items.length === 0 ? (
        <p className="r hint">還沒有週期帳目。房租、保費這類每月固定的收支可以記在這裡，過了到期日還沒記帳，今日頁會提醒你。</p>
      ) : (
        <ul className="acc-list">
          {items.map((it) => (
            <RecurringRow key={it.id} it={it} />
          ))}
        </ul>
      )}

      <div className="gap" />
      <h2 className="sec">新增週期帳目</h2>
      <div className="form-block">
        <Field id="rc-label" label="名稱" error={errors.label}>
          <input id="rc-label" value={label} onChange={(e) => setLabel(e.target.value)} autoComplete="off" placeholder="例如：房租" aria-describedby="rc-label-err" />
        </Field>
        <CategoryPick id="rc" kind={pick.kind} main={pick.main} sub={pick.sub} onChange={setPick} mainError={errors.main_category} />
        <Field id="rc-min" label="金額" error={errors.amount_min}>
          <input id="rc-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} autoComplete="off" aria-describedby="rc-min-err" />
        </Field>
        <Field id="rc-max" label="上限" error={errors.amount_max}>
          <input id="rc-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} autoComplete="off" placeholder="金額會變動才填" aria-describedby="rc-max-err" />
        </Field>
        <Field id="rc-day" label="每月" error={errors.due_day}>
          <input id="rc-day" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} autoComplete="off" placeholder="幾號到期（1–31）" aria-describedby="rc-day-err" />
        </Field>
        <p className="entry-n">只提醒，不會自動記帳。月底沒有的日子（例如 31 號）以當月最後一天計。</p>
        <p className="fld-err" aria-live="polite">
          {errors.form}
        </p>
        <button type="button" className="btn" onClick={create}>
          新增
        </button>
        <p className="note" aria-live="polite">
          {msg}
        </p>
      </div>
    </>
  );
}

function RecurringRow({ it }: { it: RecurringItem }) {
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const run = async (p: Promise<{ ok: boolean; errors?: { form?: string } }>) => {
    const res = await p;
    if (!res.ok) setErr(res.errors?.form ?? "失敗");
    setConfirming(false);
  };
  return (
    <li className="acc">
      <span>
        <b>{it.name}</b> <span className="note">{it.category}</span>
        <br />
        <span className="note">
          {it.schedule}・{it.amount}
          {it.active ? "" : "（已停用）"}
        </span>
      </span>
      <span className="acc-r">
        <button type="button" className="ghost" onClick={() => run(toggleRecurring(it.id, !it.active))}>
          {it.active ? "停用" : "啟用"}
          <span className="sr">：{it.name}</span>
        </button>
        {confirming ? (
          <button type="button" className="ghost" onClick={() => run(removeRecurring(it.id))}>
            確定刪除
            <span className="sr">：{it.name}</span>
          </button>
        ) : (
          <button type="button" className="ghost" onClick={() => setConfirming(true)}>
            刪除
            <span className="sr">：{it.name}</span>
          </button>
        )}
      </span>
      {err ? <span className="fld-err">{err}</span> : null}
    </li>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="fld-wrap">
      <div className="fld">
        <label htmlFor={id}>{label}</label>
        {children}
      </div>
      <p id={`${id}-err`} className="fld-err" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
