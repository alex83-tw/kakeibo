import { dayOfMonth, monthRange } from "@/lib/time";
import type { Entry } from "./types";

export type AlertKind =
  | "budget-over"
  | "budget-projected"
  | "budget-warning"
  | "reconcile"
  | "uncategorized"
  | "duplicate"
  | "abnormal"
  | "missing-recurring";

export interface Alert {
  kind: AlertKind;
  /** The whole sentence in plain text. */
  text: string;
  href: string;
  /** Optional pieces for rich rendering: **subject** body <emphasis> [actionLabel]. */
  subject?: string;
  body?: string;
  emphasis?: string;
  actionLabel?: string;
  /** 記一筆 prefilled from the rule this alert is about; the alert then opens the entry form instead of linking. */
  preset?: { main: string; sub: string; notes: string };
}

const live = (e: Entry) => e.deleted_at === null && e.entry_type !== "transfer";

export function findDuplicates(entries: Entry[]): Entry[][] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!live(e)) continue;
    const key = [e.entry_type, e.entry_date, e.amount, e.account_id, e.main_category].join("|");
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

function sixMonthsBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const idx = y * 12 + (m - 1) - 6;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Today's expenses that are ≥ 3× the category's 6-month median single-entry amount and ≥ NT$1,000. */
export function findAbnormal(entries: Entry[], today: string): Entry[] {
  const since = sixMonthsBefore(today);
  const expenses = entries.filter((e) => live(e) && e.entry_type === "expense");
  return expenses.filter((e) => {
    if (e.entry_date !== today || e.amount < 1000) return false;
    const past = expenses
      .filter((x) => x.main_category === e.main_category && x.entry_date < today && x.entry_date >= since)
      .map((x) => x.amount);
    return past.length >= 3 && e.amount >= 3 * median(past);
  });
}

/** A rule is missing when 3+ days past its due day this month and no live entry this month names it. */
export function findMissingRecurring<R extends { id: string; name: string; due_day: number }>(
  rules: R[],
  entries: Entry[],
  today: string,
): R[] {
  const month = today.slice(0, 7);
  const days = monthRange(Number(today.slice(0, 4)), Number(today.slice(5, 7))).days;
  return rules
    .filter((r) => dayOfMonth(today) - Math.min(r.due_day, days) >= 3)
    .filter(
      (r) =>
        !entries.some(
          (e) =>
            e.deleted_at === null &&
            e.entry_date.startsWith(month) &&
            ((e.notes ?? "").includes(r.name) || e.sub_category === r.name),
        ),
    );
}

const ORDER: AlertKind[] = [
  "budget-over",
  "budget-projected",
  "budget-warning",
  "reconcile",
  "uncategorized",
  "duplicate",
  "abnormal",
  "missing-recurring",
];

export function topAlerts(alerts: Alert[], limit = 3): Alert[] {
  return alerts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => ORDER.indexOf(x.a.kind) - ORDER.indexOf(y.a.kind) || x.i - y.i)
    .slice(0, limit)
    .map(({ a }) => a);
}
