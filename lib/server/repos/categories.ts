import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryKind } from "@/lib/domain/categories";

export interface CategoryRef {
  main: string;
  /** null = the whole main category */
  sub: string | null;
}
export interface CategoryCounts {
  entries: number;
  budgets: number;
  rules: number;
  recurring: number;
}

const toCounts = (d: unknown): CategoryCounts => {
  const r = (d ?? {}) as Record<string, unknown>;
  return { entries: Number(r.entries ?? 0), budgets: Number(r.budgets ?? 0), rules: Number(r.rules ?? 0), recurring: Number(r.recurring ?? 0) };
};

/** How many rows a rename/merge of `from` would touch (the RPC is scoped to `userId`). */
export async function categoryUsage(client: SupabaseClient, userId: string, kind: EntryKind, from: CategoryRef): Promise<CategoryCounts> {
  const { data, error } = await client.rpc("category_usage", { p_user: userId, p_kind: kind, p_main: from.main, p_sub: from.sub });
  if (error) throw new Error(error.message);
  return toCounts(data);
}

export async function renameOrMergeCategory(
  client: SupabaseClient,
  userId: string,
  kind: EntryKind,
  from: CategoryRef,
  to: CategoryRef,
): Promise<CategoryCounts & { budget_conflicts: number }> {
  const { data, error } = await client.rpc("rename_or_merge_category", {
    p_user: userId,
    p_kind: kind,
    p_from_main: from.main,
    p_from_sub: from.sub,
    p_to_main: to.main,
    p_to_sub: to.sub,
  });
  if (error) throw new Error(error.message);
  return { ...toCounts(data), budget_conflicts: Number((data as Record<string, unknown> | null)?.budget_conflicts ?? 0) };
}
