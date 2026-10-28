"use server";

import { revalidatePath } from "next/cache";
import { validateBudgetInput, type BudgetInput } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { copyBudgetsFromPrevious, deleteBudget, upsertBudget } from "@/lib/server/repos/budgets";
import { createServerClient } from "@/lib/server/supabase";
import { shiftMonth } from "@/lib/time";

export type BudgetResult = { ok: true } | { ok: false; error: string };

async function guarded(fn: (userId: string, client: Awaited<ReturnType<typeof createServerClient>>) => Promise<BudgetResult>): Promise<BudgetResult> {
  try {
    const res = await fn(await getUserId(), await createServerClient());
    if (res.ok) {
      revalidatePath("/", "layout");
    }
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, error: "請先登入" };
    return { ok: false, error: "儲存失敗，請稍後再試" };
  }
}

export async function setBudget(input: BudgetInput): Promise<BudgetResult> {
  const v = validateBudgetInput(input);
  if (!v.ok) return { ok: false, error: Object.values(v.errors)[0] };
  return guarded(async (userId, client) => {
    await upsertBudget(client, userId, v.value);
    return { ok: true };
  });
}

export async function clearBudget(input: { main_category: string; year: number; month: number }): Promise<BudgetResult> {
  return guarded(async (userId, client) => {
    await deleteBudget(client, userId, input);
    return { ok: true };
  });
}

/** 沿用上月：only when this month has no budget yet. */
export async function copyLastMonthBudget(input: { year: number; month: number }): Promise<BudgetResult> {
  const prev = shiftMonth(input.year, input.month, -1);
  return guarded(async (userId, client) => {
    const n = await copyBudgetsFromPrevious(client, userId, prev, input);
    return n > 0 ? { ok: true } : { ok: false, error: "上個月沒有預算可沿用，或本月已有預算" };
  });
}
