import { normalizeSub, subLabel } from "./categories";
import { ruleName, type RecurringRule } from "./recurring";
import type { Entry } from "./types";

export interface RecurringSuggestion {
  label: string;
  entry_type: "income" | "expense";
  main: string;
  sub: string;
  /** TWD, whole numbers */
  min: number;
  max: number;
  /** the usual day of the month */
  day: number;
  /** how many months in a row it showed up, ending at `last` */
  months: number;
  last: string;
}

const LABEL_MAX = 20;
const MIN_RUN = 3;
const MAX_DAY_SPREAD = 7;
/** A bill that stopped showing up is no longer worth suggesting. */
const MAX_STALE_MONTHS = 2;

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Entries that look like a monthly bill: the same type, category and note (a note-less group goes by category alone),
 * exactly one a month for at least three months in a row, on about the same day, and still going.
 * Anything an active rule already covers (same category, or same name) is left out.
 */
export function detectRecurring(entries: Entry[], rules: RecurringRule[], today: string): RecurringSuggestion[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.deleted_at !== null || e.entry_type === "transfer") continue;
    const key = [e.entry_type, e.main_category, normalizeSub(e.sub_category), (e.notes ?? "").trim().toLowerCase()].join("|");
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const active = rules.filter((r) => r.is_active);
  const covered = (e: Entry) => active.some((r) => (r.entry_type === e.entry_type && r.main_category === e.main_category && normalizeSub(r.sub_category) === normalizeSub(e.sub_category)) || (e.notes?.trim() && ruleName(r) === e.notes.trim()));
  const now = monthIndex(today);
  const out: RecurringSuggestion[] = [];

  for (const list of groups.values()) {
    const byMonth = new Map<number, Entry>();
    let twice = false;
    for (const e of list) {
      const m = monthIndex(e.entry_date);
      if (byMonth.has(m)) twice = true;
      byMonth.set(m, e);
    }
    if (twice || byMonth.size < MIN_RUN || covered(list[0])) continue;
    const months = [...byMonth.keys()].sort((a, b) => a - b);
    let run = 1;
    while (run < months.length && months[months.length - 1 - run] === months[months.length - run] - 1) run++;
    if (run < MIN_RUN || now - months[months.length - 1] > MAX_STALE_MONTHS) continue;
    const recent = months.slice(-run).map((m) => byMonth.get(m)!);
    const days = recent.map((e) => Number(e.entry_date.slice(8, 10)));
    if (Math.max(...days) - Math.min(...days) > MAX_DAY_SPREAD) continue;
    const amounts = recent.map((e) => Math.round(e.amount));
    const first = recent[0];
    out.push({
      label: [...(first.notes?.trim() || (normalizeSub(first.sub_category) === "other" ? first.main_category : subLabel(normalizeSub(first.sub_category))))].slice(0, LABEL_MAX).join(""), // recurring labels are capped (validateRecurringInput)
      entry_type: first.entry_type as "income" | "expense",
      main: first.main_category,
      sub: normalizeSub(first.sub_category),
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      day: median(days),
      months: run,
      last: recent[recent.length - 1].entry_date,
    });
  }
  return out.sort((a, b) => b.months - a.months || b.max - a.max);
}
