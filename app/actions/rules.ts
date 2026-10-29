"use server";

import { revalidatePath } from "next/cache";
import { validateRuleInput, type RuleInput } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { deleteCategoryRule, insertCategoryRule } from "@/lib/server/repos/rules";
import { createServerClient } from "@/lib/server/supabase";

export type RuleResult = { ok: true } | { ok: false; errors: Partial<Record<keyof RuleInput | "form", string>> };

async function guarded(run: (userId: string, client: Awaited<ReturnType<typeof createServerClient>>) => Promise<RuleResult>): Promise<RuleResult> {
  try {
    const res = await run(await getUserId(), await createServerClient());
    if (res.ok) revalidatePath("/", "layout"); // the entry form reads these rules from the layout
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, errors: { form: "請先登入" } };
    return { ok: false, errors: { form: "儲存失敗，請稍後再試" } };
  }
}

export async function createRule(input: RuleInput): Promise<RuleResult> {
  const v = validateRuleInput(input);
  if (!v.ok) return { ok: false, errors: v.errors };
  return guarded(async (userId, client) =>
    (await insertCategoryRule(client, userId, v.value)) ? { ok: true } : { ok: false, errors: { keyword: "這個關鍵字已經有規則了" } },
  );
}

export async function removeRule(id: string): Promise<RuleResult> {
  return guarded(async (userId, client) =>
    (await deleteCategoryRule(client, userId, id)) ? { ok: true } : { ok: false, errors: { form: "找不到這條規則" } },
  );
}
