import { MAX_AMOUNT, parseAmountInput } from "@/lib/money";
import { isRealDate } from "@/lib/time";
import { normalizeSub } from "./categories";
import { CURRENCIES } from "./fx";
import type { AccountKind, EntryType } from "./types";

export interface EntryInput {
  entry_type: EntryType;
  amount: string;
  /** TWD when absent (CSV rows) */
  currency?: string;
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
  currency: string;
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

  const currency = input.currency ?? "TWD";
  if (!(CURRENCIES as readonly string[]).includes(currency)) errors.currency = "幣別不正確";
  else if (transfer && currency !== "TWD") errors.currency = "轉帳只能用台幣";

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
      currency,
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

export interface RecurringInput {
  label: string;
  entry_type: "income" | "expense";
  main_category: string;
  sub_category: string;
  amount_min: string;
  /** Blank means the same as the minimum. */
  amount_max: string;
  due_day: string;
}
export interface ValidRecurring {
  label: string;
  entry_type: "income" | "expense";
  main_category: string;
  sub_category: string;
  amount_twd_min: number;
  amount_twd_max: number;
  start_date: string;
}

/**
 * recurring_rules has no due-day column: the due day is the day of start_date. January has 31 days, so
 * any due day fits; `year` only has to be a real year.
 */
export function validateRecurringInput(
  input: RecurringInput,
  year: number,
): { ok: true; value: ValidRecurring } | { ok: false; errors: Partial<Record<keyof RecurringInput, string>> } {
  const errors: Partial<Record<keyof RecurringInput, string>> = {};
  const label = input.label.trim();
  if (label === "") errors.label = "請輸入名稱";
  else if ([...label].length > 20) errors.label = "名稱最多 20 字";
  if (input.main_category.trim() === "") errors.main_category = "請選擇科目";

  const min = checkAmount(input.amount_min);
  if ("error" in min) errors.amount_min = min.error;
  const blankMax = input.amount_max.trim() === "";
  const max = blankMax ? min : checkAmount(input.amount_max);
  if ("error" in max) {
    if (!blankMax) errors.amount_max = max.error;
  } else if (!("error" in min) && max.amount < min.amount) errors.amount_max = "上限不能小於下限";

  const day = /^\d{1,2}$/.test(input.due_day.trim()) ? Number(input.due_day) : 0;
  if (day < 1 || day > 31) errors.due_day = "到期日是 1 到 31 的整數";

  if (Object.keys(errors).length > 0 || "error" in min || "error" in max) return { ok: false, errors };
  return {
    ok: true,
    value: {
      label,
      entry_type: input.entry_type,
      main_category: input.main_category.trim(),
      sub_category: normalizeSub(input.sub_category),
      amount_twd_min: min.amount,
      amount_twd_max: max.amount,
      start_date: `${year}-01-${String(day).padStart(2, "0")}`,
    },
  };
}

export interface RuleInput {
  keyword: string;
  entry_type: "income" | "expense";
  main_category: string;
  sub_category: string;
}

export function validateRuleInput(
  input: RuleInput,
): { ok: true; value: RuleInput } | { ok: false; errors: Partial<Record<keyof RuleInput, string>> } {
  const errors: Partial<Record<keyof RuleInput, string>> = {};
  const keyword = input.keyword.trim();
  if (keyword === "") errors.keyword = "請輸入關鍵字";
  else if ([...keyword].length > 30) errors.keyword = "關鍵字最多 30 字";
  if (input.main_category.trim() === "") errors.main_category = "請選擇科目";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { keyword, entry_type: input.entry_type, main_category: input.main_category.trim(), sub_category: normalizeSub(input.sub_category) },
  };
}
