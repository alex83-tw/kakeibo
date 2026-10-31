"use client";

import Link from "next/link";
import { useState } from "react";
import { applyImport, previewImport, type ImportPreview } from "@/app/actions/csv";
import { Hint } from "@/components/paper/Hint";

const SHOWN_ERRORS = 20;

export function ImportExport() {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setDone("");
    setPreview(null);
    if (!file) return setText(null);
    const t = await file.text();
    setText(t);
    setFileName(file.name);
    setPreview(await previewImport(t));
  }

  async function confirm() {
    if (text === null) return;
    setBusy(true);
    const res = await applyImport(text);
    setBusy(false);
    setDone(res.ok ? `已匯入 ${res.added} 筆` : res.error);
    if (res.ok) {
      setPreview(null);
      setText(null);
    }
  }

  return (
    <>
      <h2 className="sec">匯出</h2>
      <div className="form-block">
        <p className="entry-n">未刪除的帳目（含轉帳），外幣帳目照原幣別與金額。JSON 只能匯出、不能匯回。</p>
        <form action="/settings/import-export/export" method="get">
          <div className="fld">
            <label htmlFor="exp-year">範圍</label>
            <select id="exp-year" name="year" defaultValue="">
              <option value="">全部年份</option>
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="exp-fmt">格式</label>
            <select id="exp-fmt" name="format" defaultValue="csv">
              <option value="csv">CSV（可匯回）</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <button type="submit" className="btn">
            下載
          </button>
        </form>
      </div>

      <div className="gap" />
      <h2 className="sec">信用卡明細</h2>
      <div className="form-block">
        <p className="entry-n">從網銀複製信用卡明細貼上，看過一遍再匯入。</p>
        <Link className="btn" href="/settings/import-export/card">
          貼上信用卡明細
        </Link>
      </div>

      <div className="gap" />
      <h2 className="sec">匯入</h2>
      <div className="form-block">
        <p className="entry-n">表頭須是「日期,類型,科目,子科目,金額,幣別,帳戶,轉入帳戶,備註」（沒有「幣別」欄的舊檔也能匯入，一律當台幣）。已經在帳本裡的相同帳目會自動略過。</p>
        <Hint>
          <a href="/settings/import-export/template" download>
            下載範本
          </a>
          （表頭加一行範例）
        </Hint>
        <div className="pick">
          <input id="imp-file" className="sr" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
          <label htmlFor="imp-file" className="btn">
            選擇 CSV 檔案
          </label>
        </div>
        {fileName && text !== null ? <p className="note">{fileName}</p> : null}

        {preview && !preview.ok ? <p className="fld-err" role="alert">{preview.error}</p> : null}
        {preview?.ok ? (
          <div className="cc-result" aria-live="polite">
            <p>
              {fileName}：<b>{preview.toAdd} 筆將新增</b>，{preview.duplicates} 筆已存在，{preview.errors.length} 行有問題
              {preview.errors.length > 0 ? "（會略過）" : ""}。
            </p>
            {preview.sample.length > 0 ? (
              <ul className="note">
                {preview.sample.map((s, n) => (
                  <li key={n}>
                    {s.date}　{s.text}　{s.amount}
                  </li>
                ))}
                {preview.toAdd > preview.sample.length ? <li>…另有 {preview.toAdd - preview.sample.length} 筆</li> : null}
              </ul>
            ) : null}
            {preview.errors.length > 0 ? (
              <ul className="note">
                {preview.errors.slice(0, SHOWN_ERRORS).map((e) => (
                  <li key={e.line}>
                    第 {e.line} 行：{e.message}
                  </li>
                ))}
                {preview.errors.length > SHOWN_ERRORS ? <li>還有 {preview.errors.length - SHOWN_ERRORS} 行…</li> : null}
              </ul>
            ) : null}
            <button type="button" className="btn" disabled={busy || preview.toAdd === 0} onClick={confirm}>
              確認匯入 {preview.toAdd} 筆
            </button>
          </div>
        ) : null}
        <p className="note" aria-live="polite">
          {done}
        </p>
      </div>
    </>
  );
}
