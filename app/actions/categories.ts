"use server";

import { revalidatePath } from "next/cache";
import { normalizeSub, type EntryKind } from "@/lib/domain/categories";
import { getUserId } from "@/lib/server/auth";
import { categoryUsage, renameOrMergeCategory, type CategoryCounts, type CategoryRef } from "@/lib/server/repos/categories";
import { createServerClient } from "@/lib/server/supabase";

export type CategoryChangeResult =
  | ({ ok: true } & CategoryCounts & { budget_conflicts?: number })
  | { ok: false; error: string };

/** Normalizes both ends; returns an error message when the change makes no sense. */
function check(kind: EntryKind, from: CategoryRef, to: CategoryRef): { from: CategoryRef; to: CategoryRef } | string {
  if (kind !== "expense" && kind !== "income") return "種類不正確";
  const toMain = to.main.trim();
  if (toMain === "" || from.main.trim() === "") return "請輸入科目名稱";
  if (toMain === "轉帳") return "「轉帳」是保留名稱，不能當科目";
  const wholeMain = from.sub === null;
  const toSub = wholeMain ? null : normalizeSub(to.sub);
  if (!wholeMain && (to.sub ?? "").trim() === "") return "請輸入子科目名稱";
  const fromRef = { main: from.main.trim(), sub: wholeMain ? null : normalizeSub(from.sub) };
  const toRef = { main: toMain, sub: toSub };
  if (fromRef.main === toRef.main && fromRef.sub === toRef.sub) return "來源與目標相同";
  return { from: fromRef, to: toRef };
}

async function run<T>(fn: (client: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>, failure: string): Promise<T | { ok: false; error: string }> {
  try {
    await getUserId();
    return await fn(await createServerClient());
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, error: "請先登入" };
    return { ok: false, error: failure };
  }
}

/** What a rename/merge of `from` would touch. A source with nothing in it is all zeros, not an error. */
export async function previewCategoryChange(kind: EntryKind, from: CategoryRef, to: CategoryRef): Promise<CategoryChangeResult> {
  const c = check(kind, from, to);
  if (typeof c === "string") return { ok: false, error: c };
  return run(async (client) => ({ ok: true as const, ...(await categoryUsage(client, kind, c.from)) }), "預覽失敗，請稍後再試");
}

export async function applyCategoryChange(kind: EntryKind, from: CategoryRef, to: CategoryRef): Promise<CategoryChangeResult> {
  const c = check(kind, from, to);
  if (typeof c === "string") return { ok: false, error: c };
  const res = await run(async (client) => ({ ok: true as const, ...(await renameOrMergeCategory(client, kind, c.from, c.to)) }), "變更失敗，請稍後再試");
  if (res.ok) {
    revalidatePath("/", "layout");
  }
  return res;
}
