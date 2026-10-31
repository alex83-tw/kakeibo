"use client";

import { useState } from "react";
import { createRecurring } from "@/app/actions/recurring";
import { subLabel } from "@/lib/domain/categories";
import type { RecurringSuggestion } from "@/lib/domain/recurring-detect";
import { formatAmount } from "@/lib/money";

/** Bills the ledger shows every month that have no rule yet; 加入 makes the rule so 今日 can remind about it. */
export function RecurringSuggestions({ suggestions }: { suggestions: RecurringSuggestion[] }) {
  const [added, setAdded] = useState<Record<string, true>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (suggestions.length === 0) return null;
  const keyOf = (s: RecurringSuggestion) => `${s.entry_type}|${s.main}|${s.sub}|${s.label}`;

  async function add(s: RecurringSuggestion) {
    const res = await createRecurring({
      label: s.label,
      entry_type: s.entry_type,
      main_category: s.main,
      sub_category: s.sub,
      amount_min: String(s.min),
      amount_max: String(s.max),
      due_day: String(s.day),
      frequency: "monthly",
    });
    if (res.ok) setAdded((a) => ({ ...a, [keyOf(s)]: true }));
    else setErrors((e) => ({ ...e, [keyOf(s)]: res.errors.form ?? Object.values(res.errors)[0] ?? "失敗" }));
  }

  return (
    <>
      <h2 className="sec">看起來是固定的收支</h2>
      <p className="r hint">
        <span className="wrap">最近幾個月每月都出現、日期差不多，還沒有週期帳目。加入後，過了到期日還沒記帳，今日頁會提醒。</span>
      </p>
      <ul className="acc-list">
        {suggestions.map((s) => (
          <li key={keyOf(s)} className="acc">
            <span>
              <b>{s.label}</b>{" "}
              <span className="note">
                {s.main}／{subLabel(s.sub)}　{s.min === s.max ? formatAmount(s.min) : `${formatAmount(s.min)}～${formatAmount(s.max)}`}　每月 {s.day} 日（連續 {s.months} 個月）
              </span>
            </span>
            {added[keyOf(s)] ? (
              <span className="note">已加入</span>
            ) : (
              <button type="button" className="ghost" onClick={() => add(s)}>
                加入<span className="sr">：{s.label}</span>
              </button>
            )}
            {errors[keyOf(s)] ? <span className="fld-err">{errors[keyOf(s)]}</span> : null}
          </li>
        ))}
      </ul>
      <div className="gap" />
    </>
  );
}
