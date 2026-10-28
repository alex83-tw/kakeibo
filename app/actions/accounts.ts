"use server";

import { revalidatePath } from "next/cache";
import { validateAccountInput, type AccountInput } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { insertAccount, setAccountArchived } from "@/lib/server/repos/accounts";
import { createServerClient } from "@/lib/server/supabase";

export type AccountResult =
  | { ok: true; id?: string }
  | { ok: false; errors: Partial<Record<keyof AccountInput | "form", string>> };

async function guarded(fn: (userId: string, client: Awaited<ReturnType<typeof createServerClient>>) => Promise<AccountResult>): Promise<AccountResult> {
  try {
    const res = await fn(await getUserId(), await createServerClient());
    if (res.ok) {
      revalidatePath("/", "layout");
    }
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, errors: { form: "請先登入" } };
    return { ok: false, errors: { form: "儲存失敗，請稍後再試" } };
  }
}

export async function createAccount(input: AccountInput): Promise<AccountResult> {
  const v = validateAccountInput(input);
  if (!v.ok) return { ok: false, errors: v.errors };
  return guarded(async (userId, client) => ({ ok: true, id: await insertAccount(client, userId, v.value) }));
}

export async function archiveAccount(id: string, archived: boolean): Promise<AccountResult> {
  return guarded(async (userId, client) =>
    (await setAccountArchived(client, userId, id, archived)) ? { ok: true } : { ok: false, errors: { form: "找不到這個帳戶" } },
  );
}
