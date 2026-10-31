"use server";

import { revalidatePath } from "next/cache";
import { budgetClose } from "@/lib/domain/month-end";
import { getUserId } from "@/lib/server/auth";
import { listBudgets, upsertPlans } from "@/lib/server/repos/budgets";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { monthRange, shiftMonth } from "@/lib/time";

export type CloseResult = { ok: true; carried: number; created: number } | { ok: false; error: string };

/**
 * 月結: what each budget has left (or overspent) this month becomes next month's carried-in amount (rollover_amount).
 * A category with no plan next month gets one, copying this month's amount and threshold. Safe to run again: the figure is
 * recomputed from this month's entries and replaces what was carried before.
 */
export async function closeMonth(input: { year: number; month: number }): Promise<CloseResult> {
  const { year, month } = input ?? {};
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) return { ok: false, error: "月份不正確" };
  try {
    const userId = await getUserId();
    const client = await createServerClient();
    const next = shiftMonth(year, month, 1);
    const range = monthRange(year, month);
    const [budgets, nextBudgets, entries] = await Promise.all([
      listBudgets(client, userId, year, month),
      listBudgets(client, userId, next.year, next.month),
      listEntries(client, userId, range),
    ]);
    if (budgets.length === 0) return { ok: false, error: "這個月沒有設定預算，沒有東西可以結轉" };
    const rows = budgetClose(budgets, nextBudgets, entries, range);
    const nextBy = new Map(nextBudgets.map((b) => [b.main_category, b]));
    const thisBy = new Map(budgets.map((b) => [b.main_category, b]));
    await upsertPlans(
      client,
      userId,
      next.year,
      next.month,
      rows.map((r) => {
        const base = nextBy.get(r.main) ?? thisBy.get(r.main)!;
        return { main_category: r.main, budget_amount: base.budget_amount, warning_threshold: base.warning_threshold, rollover_amount: r.remaining };
      }),
    );
    revalidatePath("/", "layout");
    return { ok: true, carried: rows.length, created: rows.filter((r) => r.nextRollover === null).length };
  } catch (e) {
    if (!(e instanceof Error && e.message === "UNAUTHENTICATED")) console.error("closeMonth", e);
    return { ok: false, error: e instanceof Error && e.message === "UNAUTHENTICATED" ? "請先登入" : "處理失敗，請稍後再試" };
  }
}
