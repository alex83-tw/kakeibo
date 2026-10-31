import { formatAmount } from "@/lib/money";
import { monthRange } from "@/lib/time";
import { foldWidth, stripImported } from "@/lib/text";
import { subLabel } from "./categories";
import type { Entry } from "./types";
import { groupByWeek } from "./weeks";

/** One written line of the ledger: one entry, or today's empty line when today has none. */
export interface LedgerLine {
  entry: Entry | null;
  day: number;
  /** the day's first line; only it shows the date */
  first: boolean;
  isToday: boolean;
  /** main category, or 轉帳 */
  cat: string;
  /** the note, else the sub-category (never 一般) */
  det: string;
  /** counted amounts: TWD income and expense only */
  income: number;
  expense: number;
  transfer: boolean;
  /** a currency with no known rate: listed, never counted */
  foreign: boolean;
  /** what is stored when it was converted to TWD (JPY 1,200), else "" */
  orig: string;
  /** total across accounts after this line (null when the caller gave no opening balance, or on today's empty line) */
  balance: number | null;
}
export interface LedgerWeek {
  start: number;
  end: number;
  income: number;
  expense: number;
  lines: LedgerLine[];
  /** balance at the end of the week, null without an opening balance */
  balance: number | null;
}
export interface LedgerView {
  weeks: LedgerWeek[];
  income: number;
  expense: number;
  net: number;
  /** balance carried in from earlier months, null when unknown */
  opening: number | null;
  closing: number | null;
}

function line(e: Entry, first: boolean, isToday: boolean): LedgerLine {
  const transfer = e.entry_type === "transfer";
  const foreign = e.currency !== "TWD";
  const counted = !transfer && !foreign;
  const sub = e.sub_category && e.sub_category !== "other" ? subLabel(e.sub_category) : "";
  return {
    entry: e,
    day: Number(e.entry_date.slice(8, 10)),
    first,
    isToday,
    cat: transfer ? "轉帳" : e.main_category,
    det: foldWidth(stripImported(e.notes?.trim() ?? "")) || (transfer ? "" : sub),
    income: counted && e.entry_type === "income" ? e.amount : 0,
    expense: counted && e.entry_type === "expense" ? e.amount : 0,
    transfer,
    foreign,
    orig: e.foreign ? `${e.foreign.currency} ${formatAmount(e.foreign.amount)}` : foreign ? `${e.currency} ${formatAmount(e.amount)}` : "",
    balance: null,
  };
}

/**
 * One month written one entry per line, grouped into Saturday-ending weeks. `entries` may include other months.
 * `opening` is the balance across accounts on the 1st; with it every line also carries the running balance (a transfer moves money
 * between accounts, so it leaves the total alone).
 */
export function buildLedger(input: { year: number; month: number; entries: Entry[]; today: string; opening?: number }): LedgerView {
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

  const linesOf = (day: number): LedgerLine[] => {
    const list = byDay.get(day);
    if (list) return list.map((e, i) => line(e, i === 0, day === todayDay));
    if (day !== todayDay) return [];
    return [{ entry: null, day, first: true, isToday: true, cat: "", det: "", income: 0, expense: 0, transfer: false, foreign: false, orig: "", balance: null }];
  };
  const daily = Array.from({ length: range.days }, (_, i) =>
    linesOf(i + 1).reduce((t, l) => ({ income: t.income + l.income, expense: t.expense + l.expense }), { income: 0, expense: 0 }),
  );

  const opening = input.opening ?? null;
  let running = opening ?? 0;
  const weeks: LedgerWeek[] = groupByWeek(year, month, daily)
    .map((w) => {
      const lines = Array.from({ length: w.end - w.start + 1 }, (_, i) => linesOf(w.start + i))
        .flat()
        .map((l) => {
          running += l.income - l.expense;
          return opening === null || l.entry === null ? l : { ...l, balance: running };
        });
      return { ...w, lines, balance: opening === null ? null : running };
    })
    .filter((w) => w.lines.length > 0);

  const income = daily.reduce((s, d) => s + d.income, 0);
  const expense = daily.reduce((s, d) => s + d.expense, 0);
  return { weeks, income, expense, net: income - expense, opening, closing: opening === null ? null : opening + income - expense };
}
