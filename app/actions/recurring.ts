"use server";

import { revalidatePath } from "next/cache";
import { validateRecurringInput, type RecurringInput } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { deleteRecurring, insertRecurring, setRecurringActive } from "@/lib/server/repos/rules";
import { createServerClient } from "@/lib/server/supabase";
import { twToday } from "@/lib/time";

export type RecurringResult = { ok: true } | { ok: false; errors: Partial<Record<keyof RecurringInput | "form", string>> };

async function guarded(run: (userId: string, client: Awaited<ReturnType<typeof createServerClient>>) => Promise<RecurringResult>): Promise<RecurringResult> {
  try {
    const res = await run(await getUserId(), await createServerClient());
    if (res.ok) {
      revalidatePath("/"); // the 今日 alert reads these rules
      revalidatePath("/settings", "layout");
    }
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, errors: { form: "請先登入" } };
    return { ok: false, errors: { form: "儲存失敗，請稍後再試" } };
  }
}

const NOT_FOUND: RecurringResult = { ok: false, errors: { form: "找不到這筆週期帳目" } };

export async function createRecurring(input: RecurringInput): Promise<RecurringResult> {
  const v = validateRecurringInput(input, Number(twToday().slice(0, 4)));
  if (!v.ok) return { ok: false, errors: v.errors };
  return guarded(async (userId, client) => {
    await insertRecurring(client, userId, v.value);
    return { ok: true };
  });
}

export async function toggleRecurring(id: string, active: boolean): Promise<RecurringResult> {
  return guarded(async (userId, client) => ((await setRecurringActive(client, userId, id, active)) ? { ok: true } : NOT_FOUND));
}

export async function removeRecurring(id: string): Promise<RecurringResult> {
  return guarded(async (userId, client) => ((await deleteRecurring(client, userId, id)) ? { ok: true } : NOT_FOUND));
}
