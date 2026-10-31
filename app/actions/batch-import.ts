"use server";

import { revalidatePath } from "next/cache";
import { categorize, markDuplicates, parseBatchText } from "@/lib/domain/batch-import";
import { validateEntryInput, type ValidEntry } from "@/lib/domain/validate";
import { getUserId } from "@/lib/server/auth";
import { failure, MAX_CHARS, MAX_ROWS } from "@/lib/server/import-guard";
import { listAccounts } from "@/lib/server/repos/accounts";
import { insertEntries, listEntries, listRecentEntries } from "@/lib/server/repos/entries";
import { listCategoryRules } from "@/lib/server/repos/rules";
import { createServerClient } from "@/lib/server/supabase";

/** One pasted line as the review table shows it. `amount` is positive TWD; a refund arrives as income. */
export interface BatchRow {
  line: number;
  date: string;
  time: string;
  merchant: string;
  amount: number;
  entry_type: "expense" | "income";
  main: string;
  sub: string;
  /** already in the ledger (same date, type and amount); off by default in the table */
  duplicate: boolean;
}

export type BatchPreview = { ok: true; rows: BatchRow[]; errors: { line: number; message: string }[] } | { ok: false; error: string };

type Client = Awaited<ReturnType<typeof createServerClient>>;

/** Live entries over the rows' date span, for the duplicate check; always re-read on the server. */
async function existingFor(client: Client, userId: string, dates: string[]) {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  return listEntries(client, userId, { start: sorted[0], end: sorted[sorted.length - 1] });
}

export async function previewBatch(text: string): Promise<BatchPreview> {
  try {
    if (typeof text !== "string" || text.length > MAX_CHARS) throw new Error("檔案太大（上限約 1 MB）");
    const userId = await getUserId();
    const client = await createServerClient();
    const { rows: parsed, errors } = parseBatchText(text);
    if (parsed.length > MAX_ROWS) throw new Error(`一次最多匯入 ${MAX_ROWS} 筆`);
    if (parsed.length === 0) return { ok: true, rows: [], errors };
    const [rules, history, existing] = await Promise.all([listCategoryRules(client, userId), listRecentEntries(client, userId), existingFor(client, userId, parsed.map((r) => r.date))]);
    const rows = parsed.map((p) => {
      const c = categorize(p, rules, history);
      return { line: p.line, date: p.date, time: p.time, merchant: p.merchant, amount: Math.abs(p.amount), entry_type: c.entry_type, main: c.main, sub: c.sub };
    });
    const dup = markDuplicates(rows, existing);
    return { ok: true, rows: rows.map((r, i) => ({ ...r, duplicate: dup[i] })), errors };
  } catch (e) {
    return failure(e);
  }
}

/** What the review table sends back: the user's final choices, never trusted as is. */
export interface BatchApplyRow extends Omit<BatchRow, "duplicate"> {
  /** the user ticked a row flagged as already in the ledger */
  keepDuplicate: boolean;
}

export async function applyBatch(accountId: string, rows: BatchApplyRow[]): Promise<{ ok: true; ids: string[]; skipped: number } | { ok: false; error: string }> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "沒有要匯入的帳目" };
    if (rows.length > MAX_ROWS) throw new Error(`一次最多匯入 ${MAX_ROWS} 筆`);
    const userId = await getUserId();
    const client = await createServerClient();
    if (accountId !== "") {
      const account = (await listAccounts(client, userId)).find((a) => a.id === accountId);
      if (!account || account.archived) return { ok: false, error: "找不到這個帳戶" };
    }

    const valid: { row: BatchApplyRow; value: ValidEntry }[] = [];
    for (const row of rows) {
      const v = validateEntryInput({
        entry_type: row.entry_type === "income" ? "income" : "expense", // a card paste never makes a transfer
        amount: String(row.amount),
        currency: "TWD",
        main_category: String(row.main),
        sub_category: String(row.sub),
        account_id: accountId,
        transfer_account_id: "",
        entry_date: String(row.date),
        notes: String(row.merchant ?? ""),
      });
      if (!v.ok) return { ok: false, error: `第 ${row.line} 行：${Object.values(v.errors)[0]}` };
      valid.push({ row, value: v.value });
    }

    const existing = await existingFor(client, userId, valid.map((v) => v.value.entry_date));
    const dup = markDuplicates(valid.map((v) => ({ date: v.value.entry_date, entry_type: v.value.entry_type as "expense" | "income", amount: v.value.amount })), existing);
    const keep = valid.filter((v, i) => !dup[i] || v.row.keepDuplicate === true);
    // the bank lists newest first: write oldest first so the entries of one day sit in the order they happened
    keep.sort((a, b) => (a.row.date + a.row.time < b.row.date + b.row.time ? -1 : a.row.date + a.row.time > b.row.date + b.row.time ? 1 : b.row.line - a.row.line));
    const ids = await insertEntries(client, userId, keep.map((v) => v.value));
    if (ids.length > 0) revalidatePath("/", "layout");
    return { ok: true, ids, skipped: valid.length - keep.length };
  } catch (e) {
    return failure(e);
  }
}
