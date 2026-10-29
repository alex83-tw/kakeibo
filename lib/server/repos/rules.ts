import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSub } from "@/lib/domain/categories";
import type { CategoryRule, RecurringRule } from "@/lib/domain/recurring";
import type { RuleInput, ValidRecurring } from "@/lib/domain/validate";

interface RecurringRow extends Omit<RecurringRule, "amount_twd_min" | "amount_twd_max" | "anchor_month"> {
  amount_twd_min: number | string;
  amount_twd_max: number | string;
  anchor_month: number | string | null;
}

export async function listRecurring(client: SupabaseClient, userId: string): Promise<RecurringRule[]> {
  const { data, error } = await client
    .from("recurring_rules")
    .select("id,label,entry_type,main_category,sub_category,amount_twd_min,amount_twd_max,frequency,anchor_month,start_date,end_date,is_active")
    .eq("user_id", userId)
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RecurringRow[]).map((r) => ({ ...r, amount_twd_min: Number(r.amount_twd_min), amount_twd_max: Number(r.amount_twd_max), anchor_month: r.anchor_month === null ? null : Number(r.anchor_month) }));
}

/** user_id is explicit (the column has no default). importance and source keep their database defaults. */
export async function insertRecurring(client: SupabaseClient, userId: string, v: ValidRecurring): Promise<string> {
  const { data, error } = await client
    .from("recurring_rules")
    .insert({ ...v, user_id: userId, is_active: true })
    .select("id");
  if (error) throw new Error(error.message);
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (!id) throw new Error("insert returned no row");
  return id;
}

/** False when this user has no rule with that id. */
export async function setRecurringActive(client: SupabaseClient, userId: string, id: string, active: boolean): Promise<boolean> {
  const { data, error } = await client
    .from("recurring_rules")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}

export async function deleteRecurring(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await client.from("recurring_rules").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}

export async function listCategoryRules(client: SupabaseClient, userId: string): Promise<CategoryRule[]> {
  const { data, error } = await client
    .from("category_rules")
    .select("id,keyword,entry_type,main_category,sub_category")
    .eq("user_id", userId)
    .order("keyword", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (Omit<CategoryRule, "sub_category"> & { sub_category: string | null })[]).map((r) => ({
    ...r,
    sub_category: normalizeSub(r.sub_category),
  }));
}

/** False when the user already has a rule for that keyword (UNIQUE(user_id, keyword)). */
export async function insertCategoryRule(client: SupabaseClient, userId: string, v: RuleInput): Promise<boolean> {
  const { error } = await client.from("category_rules").insert({ ...v, user_id: userId });
  if (!error) return true;
  if (/duplicate key|unique/i.test(error.message)) return false;
  throw new Error(error.message);
}

export async function deleteCategoryRule(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await client.from("category_rules").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}
