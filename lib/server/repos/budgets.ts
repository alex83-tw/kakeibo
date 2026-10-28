import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_WARNING_THRESHOLD = 0.8;

export interface BudgetRow {
  main_category: string;
  budget_amount: number;
  rollover_amount: number;
  warning_threshold: number;
}

interface PlanRow {
  main_category: string;
  budget_amount: number | string;
  rollover_amount: number | string | null;
  warning_threshold: number | string | null;
}

/** Thresholds are fractions (0.8). A stored value above 1 is read as a percentage (80). */
export function normalizeThreshold(raw: number | string | null): number {
  if (raw === null) return DEFAULT_WARNING_THRESHOLD;
  const n = Number(raw);
  if (!(n > 0)) return DEFAULT_WARNING_THRESHOLD;
  return n > 1 ? n / 100 : n;
}

/** Main-category budgets for one month: TWD rows whose sub_category is the stored default 'other'. */
export async function listBudgets(
  client: SupabaseClient,
  userId: string,
  year: number,
  month: number,
): Promise<BudgetRow[]> {
  const { data, error } = await client
    .from("budget_plans")
    .select("main_category, budget_amount, rollover_amount, warning_threshold")
    .eq("user_id", userId)
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("currency", "TWD")
    .eq("sub_category", "other");
  if (error) throw new Error(error.message);
  return ((data ?? []) as PlanRow[]).map((r) => ({
    main_category: r.main_category,
    budget_amount: Number(r.budget_amount),
    rollover_amount: Number(r.rollover_amount ?? 0),
    warning_threshold: normalizeThreshold(r.warning_threshold),
  }));
}
