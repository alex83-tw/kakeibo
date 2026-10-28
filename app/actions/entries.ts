"use server";

import { revalidatePath } from "next/cache";
import { validateEntryInput, type EntryInput } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { insertEntry, setEntryDeleted, updateEntryRow } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";

export type EntryActionResult =
  | { ok: true; id: string }
  | { ok: false; errors: Partial<Record<keyof EntryInput | "form", string>> };

const NOT_FOUND: EntryActionResult = { ok: false, errors: { form: "找不到這筆帳目" } };

function refresh() {
  revalidatePath("/");
  revalidatePath("/ledger");
}

async function guarded(run: (userId: string, client: Awaited<ReturnType<typeof createServerClient>>) => Promise<EntryActionResult>) {
  try {
    const result = await run(await getUserId(), await createServerClient());
    if (result.ok) refresh();
    return result;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, errors: { form: "請先登入" } } as const;
    return { ok: false, errors: { form: "儲存失敗，請稍後再試" } } as const;
  }
}

export async function createEntry(input: EntryInput): Promise<EntryActionResult> {
  const v = validateEntryInput(input);
  if (!v.ok) return { ok: false, errors: v.errors };
  return guarded(async (userId, client) => ({ ok: true, id: await insertEntry(client, userId, v.value) }));
}

export async function updateEntry(id: string, input: EntryInput): Promise<EntryActionResult> {
  const v = validateEntryInput(input);
  if (!v.ok) return { ok: false, errors: v.errors };
  return guarded(async (userId, client) => ((await updateEntryRow(client, userId, id, v.value)) ? { ok: true, id } : NOT_FOUND));
}

export async function softDeleteEntry(id: string): Promise<EntryActionResult> {
  return guarded(async (userId, client) => ((await setEntryDeleted(client, userId, id, true)) ? { ok: true, id } : NOT_FOUND));
}

export async function restoreEntry(id: string): Promise<EntryActionResult> {
  return guarded(async (userId, client) => ((await setEntryDeleted(client, userId, id, false)) ? { ok: true, id } : NOT_FOUND));
}
