import { normalizeSub, subLabel } from "./categories";
import type { Entry, LedgerAccount } from "./types";
import { validateEntryInput, type EntryInput } from "./validate";

const HEADER = ["日期", "類型", "科目", "子科目", "金額", "帳戶", "轉入帳戶", "備註"];
const TYPE_LABEL = { income: "收入", expense: "支出", transfer: "轉帳" } as const;
const TYPE_BY_LABEL = { 收入: "income", 支出: "expense", 轉帳: "transfer" } as const;

const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function entriesToCsv(entries: Entry[], accounts: LedgerAccount[]): string {
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "";
  const lines = entries.map((e) =>
    [
      e.entry_date,
      TYPE_LABEL[e.entry_type],
      e.main_category,
      subLabel(normalizeSub(e.sub_category ?? "")),
      String(e.amount),
      name(e.account_id),
      name(e.transfer_account_id),
      e.notes ?? "",
    ]
      .map(cell)
      .join(","),
  );
  return [HEADER.join(","), ...lines].join("\r\n");
}

/** RFC 4180 records; a quoted field may hold commas, quotes and line breaks. */
function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

export function parseEntriesCsv(
  text: string,
  accounts: LedgerAccount[] = [],
): { rows: EntryInput[]; errors: { line: number; message: string }[] } {
  const records = parseRecords(text.replace(/^﻿/, "")).filter((r) => !(r.length === 1 && r[0] === ""));
  if (records.length === 0) return { rows: [], errors: [] };
  if (records[0].join(",") !== HEADER.join(",")) return { rows: [], errors: [{ line: 1, message: "表頭不正確" }] };

  const rows: EntryInput[] = [];
  const errors: { line: number; message: string }[] = [];
  const idOf = (name: string) => accounts.find((a) => a.name === name)?.id;

  records.slice(1).forEach((r, i) => {
    const line = i + 2;
    const fail = (message: string) => errors.push({ line, message });
    if (r.length !== HEADER.length) return fail("欄位數不對");
    const [entry_date, typeLabel, main_category, sub_category, amount, account, transferAccount, notes] = r;
    const entry_type = TYPE_BY_LABEL[typeLabel as keyof typeof TYPE_BY_LABEL];
    if (!entry_type) return fail("類型必須是收入、支出或轉帳");
    const account_id = account === "" ? "" : idOf(account);
    if (account_id === undefined) return fail(`找不到帳戶「${account}」`);
    const transfer_account_id = transferAccount === "" ? "" : idOf(transferAccount);
    if (transfer_account_id === undefined) return fail(`找不到帳戶「${transferAccount}」`);

    const input: EntryInput = {
      entry_type,
      amount,
      main_category,
      sub_category: sub_category === "一般" ? "other" : sub_category,
      account_id,
      transfer_account_id,
      entry_date,
      notes,
    };
    const result = validateEntryInput(input);
    if (!result.ok) return fail(Object.values(result.errors)[0]);
    rows.push(input);
  });
  return { rows, errors };
}

const sameEntry = (e: { entry_date: string; entry_type: string; main_category: string; sub_category: string | null; amount: number; account_id: string | null; transfer_account_id: string | null; notes: string | null }) =>
  JSON.stringify([e.entry_date, e.entry_type, e.main_category, normalizeSub(e.sub_category), e.amount, e.account_id, e.transfer_account_id, e.notes?.trim() || null]);

/**
 * Splits parsed rows into those to write and those already in the ledger. Each live entry cancels at most
 * one row, so a file holding two identical lunches against one existing lunch still adds one.
 */
export function planImport(rows: EntryInput[], existing: Entry[]): { toAdd: EntryInput[]; duplicates: number } {
  const have = new Map<string, number>();
  for (const e of existing) if (e.deleted_at === null) have.set(sameEntry(e), (have.get(sameEntry(e)) ?? 0) + 1);
  const toAdd: EntryInput[] = [];
  let duplicates = 0;
  for (const row of rows) {
    const v = validateEntryInput(row);
    const key = v.ok ? sameEntry(v.value) : null;
    const n = key === null ? 0 : (have.get(key) ?? 0);
    if (n > 0) {
      have.set(key!, n - 1);
      duplicates++;
    } else toAdd.push(row);
  }
  return { toAdd, duplicates };
}
