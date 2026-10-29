import type { ReactNode } from "react";
import { toKanji } from "@/lib/time";

/** 標題區：直排月份＋標題＋右側附註。整塊鋪紙色，標題不壓在行線上。見開き的左頁用 level={2}，頁面只留一個 h1。 */
export function Head({ month, title, aside, id, level = 1 }: { month?: number; title: ReactNode; aside?: ReactNode; id?: string; level?: 1 | 2 }) {
  const Title = level === 1 ? "h1" : "h2";
  return (
    <div className="head" id={id}>
      {month === undefined ? null : (
        <span className="mo" aria-hidden="true">
          {toKanji(month)}月
        </span>
      )}
      <Title>{title}</Title>
      {aside}
    </div>
  );
}
