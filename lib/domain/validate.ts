import { MAX_AMOUNT, parseAmountInput } from "@/lib/money";
import { isRealDate } from "@/lib/time";
import { normalizeSub } from "./categories";
import type { AccountKind, EntryType } from "./types";

export interface EntryInput {
  entry_type: EntryType;
  amount: string;
  main_category: string;
  sub_category: string;
  account_id: string;
  transfer_account_id: string;
  entry_date: string;
  notes: string;
}

export interface ValidEntry {
  entry_type: EntryType;
  amount: number;
  main_category: string;
  sub_category: string;
  account_id: string | null;
  transfer_account_id: string | null;
  entry_date: string;
  notes: string | null;
}

export type ValidationResult =
  | { ok: true; value: ValidEntry }
  | { ok: false; errors: Partial<Record<keyof EntryInput, string>> };

/** Returns the amount, or the message to show under the field. */
function checkAmount(raw: string): { amount: number } | { error: string } {
  const s = raw.replace(/[,\s]/g, "").replace(/^△/, "-");
  if (s === "") return { error: "請輸入金額" };
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { error: "請輸入數字" };
  if (/\.\d{3,}$/.test(s)) return { error: "最多兩位小數" };
  const n = Number(s);
  if (n <= 0) return { error: "金額必須大於 0" };
  if (n > MAX_AMOUNT) return { error: "金額太大" };
  return { amount: parseAmountInput(s) ?? n };
}

export function validateEntryInput(input: EntryInput): ValidationResult {
  const errors: Partial<Record<keyof EntryInput, string>> = {};
  const transfer = input.entry_type === "transfer";

  const amount = checkAmount(input.amount);
  if ("error" in amount) errors.amount = amount.error;

  if (!transfer && input.main_category.trim() === "") errors.main_category = "請選擇科目";

  if (transfer) {
    if (input.account_id === "") errors.account_id = "請選擇轉出帳戶";
    if (input.transfer_account_id === "") errors.transfer_account_id = "請選擇轉入帳戶";
    else if (input.transfer_account_id === input.account_id) errors.transfer_account_id = "轉出與轉入不能是同一個帳戶";
  }

  if (!isRealDate(input.entry_date)) errors.entry_date = "日期不正確";

  const notes = input.notes.trim();
  if ([...notes].length > 200) errors.notes = "備註最多 200 字";

  if (Object.keys(errors).length > 0 || "error" in amount) return { ok: false, errors };

  return {
    ok: true,
    value: {
      entry_type: input.entry_type,
      amount: amount.amount,
      main_category: transfer ? "轉帳" : input.main_category.trim(),
      sub_category: transfer ? "other" : normalizeSub(input.sub_category),
      account_id: input.account_id === "" ? null : input.account_id,
      transfer_account_id: transfer ? input.transfer_account_id : null,
      entry_date: input.entry_date,
      notes: notes === "" ? null : notes,
    },
  };
}

export interface BudgetInput {
  main_category: string;
  year: number;
  month: number;
  amount: string;
  warning_threshold: number;
}
export interface ValidBudget {
  main_category: string;
  year: number;
  month: number;
  amount: number;
  warning_threshold: number;
}

export function validateBudgetInput(
  input: BudgetInput,
): { ok: true; value: ValidBudget } | { ok: false; errors: Partial<Record<keyof BudgetInput, string>> } {
  const errors: Partial<Record<keyof BudgetInput, string>> = {};
  const amount = checkAmount(input.amount);
  if ("error" in amount) errors.amount = amount.error;
  if (input.main_category.trim() === "") errors.main_category = "請選擇科目";
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12 || !Number.isInteger(input.year)) {
    errors.month = "月份不正確";
  }
  if (!(input.warning_threshold > 0 && input.warning_threshold <= 1)) {
    errors.warning_threshold = "提醒比例要在 1% 到 100% 之間";
  }
  if (Object.keys(errors).length > 0 || "error" in amount) return { ok: false, errors };
  return {
    ok: true,
    value: {
      main_category: input.main_category.trim(),
      year: input.year,
      month: input.month,
      amount: amount.amount,
      warning_threshold: input.warning_threshold,
    },
  };
}

export interface AccountInput {
  kind: AccountKind;
  name: string;
  opening_balance: string;
  opening_date: string;
}
export interface ValidAccount {
  kind: AccountKind;
  name: string;
  opening_balance: number;
  opening_date: string;
}

export function validateAccountInput(
  input: AccountInput,
): { ok: true; value: ValidAccount } | { ok: false; errors: Partial<Record<keyof AccountInput, string>> } {
  const errors: Partial<Record<keyof AccountInput, string>> = {};
  const name = input.name.trim();
  if (name === "") errors.name = "請輸入帳戶名稱";
  else if ([...name].length > 20) errors.name = "名稱最多 20 字";
  // Unlike an entry amount, an opening balance may be zero or negative (a credit card opens at △).
  const balance = parseAmountInput(input.opening_balance);
  if (balance === null) errors.opening_balance = "請輸入數字";
  if (!isRealDate(input.opening_date)) errors.opening_date = "日期不正確";
  if (Object.keys(errors).length > 0 || balance === null) return { ok: false, errors };
  return { ok: true, value: { kind: input.kind, name, opening_balance: balance, opening_date: input.opening_date } };
}
