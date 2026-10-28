"use client";

import { useState } from "react";
import { createRule, removeRule } from "@/app/actions/rules";
import { CategoryPick, type PickKind } from "./CategoryPick";

export interface RuleItem {
  id: string;
  keyword: string;
  category: string;
}

export function RuleManager({ items }: { items: RuleItem[] }) {
  const [keyword, setKeyword] = useState("");
  const [pick, setPick] = useState<{ kind: PickKind; main: string; sub: string }>({ kind: "expense", main: "", sub: "other" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function create() {
    setMsg("");
    const res = await createRule({ keyword, entry_type: pick.kind, main_category: pick.main, sub_category: pick.sub });
    if (!res.ok) return setErrors(res.errors as Record<string, string>);
    setErrors({});
    setKeyword("");
    setMsg("已新增規則");
  }

  return (
    <>
      {items.length === 0 ? (
        <p className="r hint">還沒有規則。備註裡出現某個關鍵字（例如「全聯」）時，可以對應到固定的科目。</p>
      ) : (
        <ul className="acc-list">
          {items.map((it) => (
            <RuleRow key={it.id} it={it} />
          ))}
        </ul>
      )}

      <div className="gap" />
      <h2 className="sec">新增規則</h2>
      <div className="form-block">
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="ru-kw">關鍵字</label>
            <input id="ru-kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} autoComplete="off" aria-describedby="ru-kw-err" />
          </div>
          <p id="ru-kw-err" className="fld-err" aria-live="polite">
            {errors.keyword}
          </p>
        </div>
        <CategoryPick id="ru" kind={pick.kind} main={pick.main} sub={pick.sub} onChange={setPick} mainError={errors.main_category} />
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

function RuleRow({ it }: { it: RuleItem }) {
  const [err, setErr] = useState("");
  return (
    <li className="acc">
      <span>
        <b>{it.keyword}</b> <span className="note">→ {it.category}</span>
      </span>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          const res = await removeRule(it.id);
          if (!res.ok) setErr(res.errors.form ?? "失敗");
        }}
      >
        刪除<span className="sr">：{it.keyword}</span>
      </button>
      {err ? <span className="fld-err">{err}</span> : null}
    </li>
  );
}
