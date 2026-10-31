import { monthRange, shiftMonth } from "@/lib/time";
import type { Entry } from "./types";

/** One month, or one calendar year. Amounts are TWD (listEntries already converted foreign entries). */
export type Period = { kind: "month"; year: number; month: number } | { kind: "year"; year: number };

export interface Range {
  start: string;
  end: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ym = (year: number, month: number) => `${year}-${pad(month)}`;

export function periodRange(p: Period): Range {
  return p.kind === "month" ? monthRange(p.year, p.month) : { start: `${p.year}-01-01`, end: `${p.year}-12-31` };
}

/** The period to compare with: the month before, or the year before. */
export function previousPeriod(p: Period): Period {
  if (p.kind === "year") return { kind: "year", year: p.year - 1 };
  const s = shiftMonth(p.year, p.month, -1);
  return { kind: "month", year: s.year, month: s.month };
}

/** Months in the trend table: the 6 ending at the viewed month, or Jan–Dec of the viewed year. */
export function trendMonths(p: Period): string[] {
  if (p.kind === "year") return Array.from({ length: 12 }, (_, i) => ym(p.year, i + 1));
  return Array.from({ length: 6 }, (_, i) => {
    const s = shiftMonth(p.year, p.month, i - 5);
    return ym(s.year, s.month);
  });
}

/** One read that covers the period, the one before it and the whole trend. */
export function readRange(p: Period): Range {
  const prev = periodRange(previousPeriod(p));
  const first = trendMonths(p)[0];
  const start = [prev.start, `${first}-01`].sort()[0];
  return { start, end: periodRange(p).end };
}

const inRange = (e: Entry, r: Range) => e.entry_date >= r.start && e.entry_date <= r.end;

export function totals(entries: Entry[], r: Range): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (!inRange(e, r)) continue;
    if (e.entry_type === "income") income += e.amount;
    else if (e.entry_type === "expense") expense += e.amount;
  }
  return { income, expense, net: income - expense };
}

export function monthlyTotals(entries: Entry[], months: string[]): { month: string; income: number; expense: number }[] {
  return months.map((month) => {
    const { income, expense } = totals(entries, { start: `${month}-01`, end: `${month}-31` });
    return { month, income, expense };
  });
}

export interface CategoryRow {
  main: string;
  amount: number;
  /** of all expense in the period, whole percent */
  share: number;
  prev: number;
}

/** Expense by main category, biggest first; `prev` is the same category in the comparison period. */
export function categoryBreakdown(entries: Entry[], r: Range, prev: Range): CategoryRow[] {
  const sum = (range: Range) => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.entry_type === "expense" && inRange(e, range)) m.set(e.main_category, (m.get(e.main_category) ?? 0) + e.amount);
    return m;
  };
  const cur = sum(r);
  const before = sum(prev);
  const total = [...cur.values()].reduce((a, b) => a + b, 0);
  return [...cur]
    .map(([main, amount]) => ({ main, amount, share: total > 0 ? Math.round((amount / total) * 100) : 0, prev: before.get(main) ?? 0 }))
    .sort((a, b) => b.amount - a.amount || (a.main < b.main ? -1 : 1));
}

/** Index 0 = the 1st. */
export function dailyExpense(entries: Entry[], year: number, month: number): number[] {
  const r = monthRange(year, month);
  const out = Array.from({ length: r.days }, () => 0);
  for (const e of entries) if (e.entry_type === "expense" && inRange(e, r)) out[Number(e.entry_date.slice(8, 10)) - 1] += e.amount;
  return out;
}

/** Whole-percent change from `prev` to `cur`; null when there is nothing to compare with. */
export function change(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

/** 0 (no spending) to 4, for shading a day by its share of the month's heaviest day. */
export function heatLevel(amount: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (amount <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((amount / max) * 4)) as 1 | 2 | 3 | 4;
}
