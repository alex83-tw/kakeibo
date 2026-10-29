import { monthRange } from "@/lib/time";
import { foldWidth } from "@/lib/text";
import { subLabel } from "./categories";
import type { Entry } from "./types";
import { groupByWeek } from "./weeks";

export interface LedgerRow {
  day: number;
  cat: string;
  det: string;
  income: number;
  expense: number;
  /** the day has entries that do not count (another currency) */
  excluded: boolean;
  isToday: boolean;
}
export interface LedgerWeek {
  start: number;
  end: number;
  income: number;
  expense: number;
  rows: LedgerRow[];
}
export interface LedgerView {
  weeks: LedgerWeek[];
  income: number;
  expense: number;
  net: number;
}

/** "餐飲" + "・晚餐　交通": the first entry names the day, other categories trail, and a long day gets a count. */
export function daySummary(entries: Entry[]): { cat: string; det: string } {
  const first = entries[0];
  const cat = first.entry_type === "transfer" ? "轉帳" : first.main_category;
  const lead = first.entry_type === "transfer" ? "" : foldWidth(first.notes?.trim() ?? "") || (first.sub_category ? subLabel(first.sub_category) : "");
  const others = [...new Set(entries.slice(1).map((e) => (e.entry_type === "transfer" ? "轉帳" : e.main_category)))].filter((c) => c !== cat);
  const tail = entries.length > 3 ? `（${entries.length} 筆）` : "";
  const det = `${lead ? `・${lead}` : ""}${others.length ? `　${others.join("　")}` : ""}${tail}`;
  return { cat, det };
}

/** One month of days with entries, grouped into Saturday-ending weeks. `entries` may include other months. */
export function buildLedger(input: { year: number; month: number; entries: Entry[]; today: string }): LedgerView {
  const { year, month, today } = input;
  const range = monthRange(year, month);
  const byDay = new Map<number, Entry[]>();
  for (const e of input.entries) {
    if (e.deleted_at !== null || e.entry_date < range.start || e.entry_date > range.end) continue;
    const d = Number(e.entry_date.slice(8, 10));
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const isCurrent = today.slice(0, 7) === range.start.slice(0, 7);
  const todayDay = isCurrent ? Number(today.slice(8, 10)) : -1;

  const daily = Array.from({ length: range.days }, (_, i) => {
    let income = 0;
    let expense = 0;
    for (const e of byDay.get(i + 1) ?? []) {
      if (e.currency !== "TWD" || e.entry_type === "transfer") continue;
      if (e.entry_type === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense };
  });

  const weeks: LedgerWeek[] = groupByWeek(year, month, daily)
    .map((w) => {
      const rows: LedgerRow[] = [];
      for (let day = w.start; day <= w.end; day++) {
        const list = byDay.get(day);
        if (!list && day !== todayDay) continue;
        const { cat, det } = list ? daySummary(list) : { cat: "", det: "" };
        rows.push({
          day,
          cat,
          det,
          ...daily[day - 1],
          excluded: !!list?.some((e) => e.currency !== "TWD"),
          isToday: day === todayDay,
        });
      }
      return { ...w, rows };
    })
    .filter((w) => w.rows.length > 0);

  const income = daily.reduce((s, d) => s + d.income, 0);
  const expense = daily.reduce((s, d) => s + d.expense, 0);
  return { weeks, income, expense, net: income - expense };
}
