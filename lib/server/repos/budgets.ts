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

const CONFLICT = "user_id,period_year,period_month,main_category,sub_category";

/** Main-category budget for one month. rollover_amount is left alone so an existing value survives. */
export async function upsertBudget(
  client: SupabaseClient,
  userId: string,
  b: { main_category: string; year: number; month: number; amount: number; warning_threshold: number },
): Promise<void> {
  const { error } = await client.from("budget_plans").upsert(
    {
      user_id: userId,
      main_category: b.main_category,
      sub_category: "other",
      budget_amount: b.amount,
      currency: "TWD",
      period_year: b.year,
      period_month: b.month,
      warning_threshold: b.warning_threshold,
    },
    { onConflict: CONFLICT },
  );
  if (error) throw new Error(error.message);
}

export async function deleteBudget(
  client: SupabaseClient,
  userId: string,
  b: { main_category: string; year: number; month: number },
): Promise<void> {
  const { error } = await client
    .from("budget_plans")
    .delete()
    .eq("user_id", userId)
    .eq("period_year", b.year)
    .eq("period_month", b.month)
    .eq("main_category", b.main_category)
    .eq("sub_category", "other")
    .eq("currency", "TWD");
  if (error) throw new Error(error.message);
}

/** Copies last month's main-category budgets into `to`, only when `to` has none. Returns how many were copied. */
export async function copyBudgetsFromPrevious(
  client: SupabaseClient,
  userId: string,
  from: { year: number; month: number },
  to: { year: number; month: number },
): Promise<number> {
  if ((await listBudgets(client, userId, to.year, to.month)).length > 0) return 0;
  const rows = await listBudgets(client, userId, from.year, from.month);
  for (const r of rows) {
    await upsertBudget(client, userId, {
      main_category: r.main_category,
      year: to.year,
      month: to.month,
      amount: r.budget_amount,
      warning_threshold: r.warning_threshold,
    });
  }
  return rows.length;
}

/** Writes whole plan rows (amount, threshold and rollover) for one month: closing a month carries rollover into next month's plans, creating a plan that is missing. */
export async function upsertPlans(
  client: SupabaseClient,
  userId: string,
  year: number,
  month: number,
  rows: BudgetRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from("budget_plans").upsert(
    rows.map((b) => ({
      user_id: userId,
      main_category: b.main_category,
      sub_category: "other",
      budget_amount: b.budget_amount,
      rollover_amount: b.rollover_amount,
      warning_threshold: b.warning_threshold,
      currency: "TWD",
      period_year: year,
      period_month: month,
    })),
    { onConflict: CONFLICT },
  );
  if (error) throw new Error(error.message);
}
