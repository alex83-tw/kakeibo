"use client";

import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, subLabel } from "@/lib/domain/categories";

export type PickKind = "expense" | "income";

const taxonomy = (kind: PickKind) => (kind === "expense" ? EXPENSE_TAXONOMY : INCOME_TAXONOMY);

/** Kind, main and sub as three labelled rows; ids are `${id}-kind|main|sub` so errors can describe them. */
export function CategoryPick({
  id,
  kind,
  main,
  sub,
  onChange,
  mainError,
}: {
  id: string;
  kind: PickKind;
  main: string;
  sub: string;
  onChange: (next: { kind: PickKind; main: string; sub: string }) => void;
  mainError?: string;
}) {
  const subs = (taxonomy(kind)[main] ?? []) as readonly string[];
  return (
    <>
      <div className="fld-wrap">
        <div className="fld">
          <label htmlFor={`${id}-kind`}>種類</label>
          <select id={`${id}-kind`} value={kind} onChange={(e) => onChange({ kind: e.target.value as PickKind, main: "", sub: "other" })}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>
      </div>
      <div className="fld-wrap">
        <div className="fld">
          <label htmlFor={`${id}-main`}>科目</label>
          <select id={`${id}-main`} value={main} onChange={(e) => onChange({ kind, main: e.target.value, sub: "other" })} aria-describedby={`${id}-main-err`}>
            <option value="">請選擇</option>
            {Object.keys(taxonomy(kind)).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <p id={`${id}-main-err`} className="fld-err" aria-live="polite">
          {mainError}
        </p>
      </div>
      <div className="fld-wrap">
        <div className="fld">
          <label htmlFor={`${id}-sub`}>子科目</label>
          <select id={`${id}-sub`} value={sub} disabled={main === ""} onChange={(e) => onChange({ kind, main, sub: e.target.value })}>
            <option value="other">{subLabel("other")}</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
