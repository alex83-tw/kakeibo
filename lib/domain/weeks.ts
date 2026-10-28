import { weekdayIndex } from "@/lib/time";

export interface WeekRow {
  start: number;
  end: number;
  income: number;
  expense: number;
}

/** Splits a month into weeks that end on Saturday; the first and last may be short. */
export function groupByWeek(
  year: number,
  month: number,
  daily: { income: number; expense: number }[],
): WeekRow[] {
  const weeks: WeekRow[] = [];
  let current: WeekRow | null = null;
  daily.forEach((d, i) => {
    const day = i + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!current) current = { start: day, end: day, income: 0, expense: 0 };
    current.end = day;
    current.income += d.income;
    current.expense += d.expense;
    if (weekdayIndex(date) === 6 || day === daily.length) {
      weeks.push(current);
      current = null;
    }
  });
  return weeks;
}
