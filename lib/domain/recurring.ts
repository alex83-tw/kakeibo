import { normalizeSub } from "./categories";

export interface RecurringRule {
  id: string;
  label: string | null;
  entry_type: "income" | "expense";
  main_category: string;
  sub_category: string;
  amount_twd_min: number;
  amount_twd_max: number;
  frequency: string;
  /** The month a quarterly or annual rule falls due in (1-12); null means the month of start_date. */
  anchor_month: number | null;
  /** The due day of a rule is the day of this date. */
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface CategoryRule {
  id: string;
  keyword: string;
  entry_type: "income" | "expense";
  main_category: string;
  sub_category: string;
}

/** The text an entry's notes or sub category would carry when this rule was booked. */
export function ruleName(r: Pick<RecurringRule, "label" | "main_category" | "sub_category">): string {
  const label = r.label?.trim();
  if (label) return label;
  const sub = normalizeSub(r.sub_category);
  return sub === "other" ? r.main_category : sub;
}

/** The month a quarterly or annual rule is anchored on: anchor_month when it is a real month, else the month of start_date. */
export function anchorMonth(r: Pick<RecurringRule, "anchor_month" | "start_date">): number {
  const a = r.anchor_month;
  return a !== null && Number.isInteger(a) && a >= 1 && a <= 12 ? a : Number(r.start_date.slice(5, 7));
}

/** Whether a rule of this frequency falls due in `month` (1-12). */
function dueInMonth(r: RecurringRule, month: number): boolean {
  if (r.frequency === "monthly") return true;
  const anchor = anchorMonth(r);
  if (r.frequency === "quarterly") return (((month - anchor) % 3) + 3) % 3 === 0;
  return r.frequency === "annual" && month === anchor;
}

/** Active rules in force today and due this month (monthly, plus quarterly and annual in their months), in the shape findMissingRecurring takes. */
export function dueRules(
  rules: RecurringRule[],
  today: string,
): { id: string; name: string; due_day: number; main: string; sub: string }[] {
  return rules
    .filter((r) => r.is_active && dueInMonth(r, Number(today.slice(5, 7))) && r.start_date <= today && (r.end_date === null || r.end_date >= today))
    .map((r) => ({ id: r.id, name: ruleName(r), due_day: Number(r.start_date.slice(8, 10)), main: r.main_category, sub: normalizeSub(r.sub_category) }));
}
