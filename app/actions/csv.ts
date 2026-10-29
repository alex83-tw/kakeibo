"use server";

import { revalidatePath } from "next/cache";
import { parseEntriesCsv, planImport } from "@/lib/domain/csv";
import { validateEntryInput, type ValidEntry } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { insertEntries, listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";

const MAX_CHARS = 1_000_000;
const MAX_ROWS = 5000;

export type ImportPreview =
  | { ok: true; toAdd: number; duplicates: number; errors: { line: number; message: string }[] }
  | { ok: false; error: string };

/** Always re-derived on the server from the text: the client's preview is never what gets written. */
async function plan(text: string) {
  if (text.length > MAX_CHARS) throw new Error("檔案太大（上限約 1 MB）");
  const userId = await getUserId();
  const client = await createServerClient();
  const { rows, errors } = parseEntriesCsv(text, await listAccounts(client, userId));
  if (rows.length > MAX_ROWS) throw new Error(`一次最多匯入 ${MAX_ROWS} 筆`);
  const dates = rows.map((r) => r.entry_date).sort();
  // Only TWD rows are comparable: the CSV carries no currency, and an exported file holds TWD only.
  const existing =
    rows.length === 0 ? [] : (await listEntries(client, userId, { start: dates[0], end: dates[dates.length - 1] })).filter((e) => e.currency === "TWD");
  return { userId, client, errors, ...planImport(rows, existing) };
}

function failure(e: unknown): { ok: false; error: string } {
  if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, error: "請先登入" };
  if (e instanceof Error && (e.message.startsWith("檔案") || e.message.startsWith("一次"))) return { ok: false, error: e.message };
  return { ok: false, error: "處理失敗，請稍後再試" };
}

export async function previewImport(text: string): Promise<ImportPreview> {
  try {
    const p = await plan(text);
    return { ok: true, toAdd: p.toAdd.length, duplicates: p.duplicates, errors: p.errors };
  } catch (e) {
    return failure(e);
  }
}

export async function applyImport(text: string): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  try {
    const p = await plan(text);
    const values = p.toAdd.map((r) => validateEntryInput(r)).flatMap((v) => (v.ok ? [v.value] : [])) satisfies ValidEntry[];
    await insertEntries(p.client, p.userId, values);
    revalidatePath("/", "layout");
    return { ok: true, added: values.length };
  } catch (e) {
    return failure(e);
  }
}
