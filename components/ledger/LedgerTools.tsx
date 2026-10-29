"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * 帳本上方一行：篩選（科目、摘要、帳戶）與回到今日。表格是伺服器畫的，這裡只切換 tr 的 hidden，不另外查資料。
 * 進到本月時捲到今日那一行（有網址 #d-DD 時尊重網址）。捲動的容器桌面是左頁、手機是視窗，scrollIntoView 兩種都對。
 */
export function LedgerTools({ monthKey, currentKey, todayId, path }: { monthKey: string; currentKey: string; todayId: string; path: string }) {
  const [q, setQ] = useState("");
  const status = useRef<HTMLSpanElement>(null);
  const isCurrent = monthKey === currentKey;

  useEffect(() => {
    if (isCurrent && !window.location.hash) document.getElementById(todayId)?.scrollIntoView({ block: "start" });
  }, [monthKey, isCurrent, todayId]);

  // The table is replaced on every month change, so the filter is re-applied to the new rows.
  useEffect(() => {
    const table = document.querySelector<HTMLTableElement>(".lg-t");
    if (!table) return;
    const needle = q.trim().toLowerCase();
    let shown = 0;
    table.querySelectorAll<HTMLTableRowElement>("tbody tr[data-q]").forEach((tr) => {
      const hit = needle === "" || (tr.dataset.q ?? "").includes(needle);
      tr.hidden = !hit;
      if (hit) shown++;
    });
    table.querySelectorAll<HTMLTableRowElement>("tbody tr.wk, tbody tr.sum").forEach((tr) => {
      tr.hidden = needle !== "";
    });
    table.classList.toggle("filtering", needle !== "");
    if (status.current) status.current.textContent = needle === "" ? "" : shown === 0 ? "沒有符合的帳目" : `${shown} 筆`;
  }, [q, monthKey]);

  return (
    <div className="lg-tools">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="篩選：科目、摘要、帳戶" aria-label="篩選帳目" autoComplete="off" />
      <span ref={status} className="lg-n" role="status" />
      {isCurrent ? (
        <button type="button" className="act" onClick={() => document.getElementById(todayId)?.scrollIntoView({ block: "start", behavior: "smooth" })}>
          今日
        </button>
      ) : (
        <Link className="act" href={`${path}?m=${currentKey}#${todayId}`}>
          回到本月
        </Link>
      )}
    </div>
  );
}
