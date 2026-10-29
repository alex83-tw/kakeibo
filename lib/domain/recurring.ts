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
  /** The due day of a monthly rule is the day of this date. */
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

/** Active monthly rules in force today, in the shape findMissingRecurring takes. */
export function dueRules(
  rules: RecurringRule[],
  today: string,
): { id: string; name: string; due_day: number; main: string; sub: string }[] {
  return rules
    .filter((r) => r.is_active && r.frequency === "monthly" && r.start_date <= today && (r.end_date === null || r.end_date >= today))
    .map((r) => ({ id: r.id, name: ruleName(r), due_day: Number(r.start_date.slice(8, 10)), main: r.main_category, sub: normalizeSub(r.sub_category) }));
}
