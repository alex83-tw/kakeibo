"use client";

import { useState } from "react";
import { applyCategoryChange, previewCategoryChange, type CategoryChangeResult } from "@/app/actions/categories";
import type { EntryKind } from "@/lib/domain/categories";
import { subLabel } from "@/lib/domain/categories";
import type { MainInventory } from "@/lib/domain/inventory";

type Scope = "main" | "sub";

const describe = (r: Extract<CategoryChangeResult, { ok: true }>) =>
  `${r.entries} 筆帳目、${r.budgets} 筆預算、${r.rules} 條自動分類、${r.recurring} 筆週期帳目`;

export function CategoryChangeForm({ inventory }: { inventory: Record<EntryKind, MainInventory[]> }) {
  const [kind, setKind] = useState<EntryKind>("expense");
  const [scope, setScope] = useState<Scope>("main");
  const [fromMain, setFromMain] = useState("");
  const [fromSub, setFromSub] = useState("other");
  const [toMain, setToMain] = useState("");
  const [toSub, setToSub] = useState("");
  const [preview, setPreview] = useState<CategoryChangeResult | null>(null);
  const [done, setDone] = useState<CategoryChangeResult | null>(null);

  const mains = inventory[kind];
  const subs = mains.find((m) => m.main === fromMain)?.subs ?? [];
  const targetMain = mains.find((m) => m.main === toMain.trim());
  const targetExists = scope === "main" ? !!targetMain : !!targetMain?.subs.some((s) => s.sub === (toSub.trim() === "" || toSub.trim() === "一般" ? "other" : toSub.trim()));

  const ref = (main: string, sub: string) => ({ main, sub: scope === "main" ? null : sub });
  const reset = () => {
    setPreview(null);
    setDone(null);
  };

  async function doPreview() {
    setDone(null);
    setPreview(await previewCategoryChange(kind, ref(fromMain, fromSub), ref(toMain, toSub)));
  }
  async function doApply() {
    const res = await applyCategoryChange(kind, ref(fromMain, fromSub), ref(toMain, toSub));
    setDone(res);
    if (res.ok) setPreview(null);
  }

  return (
    <>
      <div className="form-block">
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="cc-kind">種類</label>
            <select id="cc-kind" value={kind} onChange={(e) => { setKind(e.target.value as EntryKind); setFromMain(""); setToMain(""); reset(); }}>
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="cc-scope">範圍</label>
            <select id="cc-scope" value={scope} onChange={(e) => { setScope(e.target.value as Scope); reset(); }}>
              <option value="main">整個主分類</option>
              <option value="sub">單一子科目</option>
            </select>
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="cc-from">從</label>
            <select id="cc-from" value={fromMain} onChange={(e) => { setFromMain(e.target.value); setFromSub("other"); reset(); }}>
              <option value="">請選擇</option>
              {mains.map((m) => (
                <option key={m.main} value={m.main}>
                  {m.main}（{m.count} 筆）
                </option>
              ))}
            </select>
          </div>
        </div>
        {scope === "sub" ? (
          <div className="fld-wrap">
            <div className="fld">
              <label htmlFor="cc-from-sub">子科目</label>
              <select id="cc-from-sub" value={fromSub} onChange={(e) => { setFromSub(e.target.value); reset(); }}>
                {subs.map((s) => (
                  <option key={s.sub} value={s.sub}>
                    {subLabel(s.sub)}（{s.count} 筆）
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="cc-to">改成</label>
            <input id="cc-to" list="cc-mains" value={toMain} onChange={(e) => { setToMain(e.target.value); reset(); }} placeholder="新的（或既有的）主分類" autoComplete="off" />
            <datalist id="cc-mains">
              {mains.map((m) => (
                <option key={m.main} value={m.main} />
              ))}
            </datalist>
          </div>
        </div>
        {scope === "sub" ? (
          <div className="fld-wrap">
            <div className="fld">
              <label htmlFor="cc-to-sub">子科目</label>
              <input id="cc-to-sub" value={toSub} onChange={(e) => { setToSub(e.target.value); reset(); }} placeholder="一般，或新的子科目" autoComplete="off" />
            </div>
          </div>
        ) : null}
        {targetExists && toMain.trim() !== "" ? <p className="entry-n">目標已存在，將合併；預算金額會相加。</p> : <p className="entry-n" />}
        <button type="button" className="btn" disabled={fromMain === "" || toMain.trim() === ""} onClick={doPreview}>
          預覽
        </button>
      </div>

      <div aria-live="polite" className="cc-result">
        {preview?.ok ? (
          <>
            <p>將影響 {describe(preview)}。確認後無法復原。</p>
            <button type="button" className="btn" onClick={doApply}>
              確認{targetExists ? "合併" : "改名"}
            </button>
          </>
        ) : null}
        {preview && !preview.ok ? <p className="fld-err">{preview.error}</p> : null}
        {done?.ok ? (
          <p>
            已完成：更新 {describe(done)}。
            {done.budget_conflicts ? `另有 ${done.budget_conflicts} 筆預算因幣別不同無法相加，維持原樣。` : ""}
          </p>
        ) : null}
        {done && !done.ok ? <p className="fld-err">{done.error}</p> : null}
      </div>
    </>
  );
}
