import type { ReactNode } from "react";
import { toKanji } from "@/lib/time";

/** 標題區：直排月份＋標題＋右側附註。整塊鋪紙色，標題不壓在行線上。 */
export function Head({ month, title, aside, id }: { month: number; title: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="head" id={id}>
      <span className="mo" aria-hidden="true">
        {toKanji(month)}月
      </span>
      <h1>{title}</h1>
      {aside}
    </div>
  );
}
