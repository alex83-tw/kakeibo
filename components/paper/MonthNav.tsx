import Link from "next/link";
import { formatMonthParam, shiftMonth, toKanji } from "@/lib/time";

/** 上個月／這個月／下個月。連結留在目前的路徑，只換 `?m=`；左頁帳本與預算頁共用同一個 `m`。 */
export function MonthNav({ year, month, path }: { year: number; month: number; path: string }) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  return (
    <nav className="mnav" aria-label="切換月份">
      <Link href={`${path}?m=${formatMonthParam(prev.year, prev.month)}`} scroll={false}>
        ◀ <span className="sr">上個月：</span>
        {toKanji(prev.month)}月
      </Link>
      <span aria-current="date">
        {year} 年 {toKanji(month)}月
      </span>
      <Link href={`${path}?m=${formatMonthParam(next.year, next.month)}`} scroll={false}>
        <span className="sr">下個月：</span>
        {toKanji(next.month)}月 ▶
      </Link>
    </nav>
  );
}
