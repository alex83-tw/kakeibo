"use client";

import { useState } from "react";
import { applyImport, previewImport, type ImportPreview } from "@/app/actions/csv";

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
        <p className="entry-n">所有以台幣記的帳目（含轉帳）。不含已刪除與外幣帳目，所以不是完整備份。</p>
        <a className="btn" href="/settings/import-export/export" download>
          下載 CSV
        </a>
      </div>

      <div className="gap" />
      <h2 className="sec">匯入</h2>
      <div className="form-block">
        <p className="entry-n">
          表頭須是「日期,類型,科目,子科目,金額,帳戶,轉入帳戶,備註」。已經在帳本裡的相同帳目會自動略過。
          <a href="/settings/import-export/template" download>
            下載範本
          </a>
        </p>
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
