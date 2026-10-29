import { describe, expect, it } from "vitest";
import { validateAccountInput, validateBudgetInput, validateEntryInput, type EntryInput } from "./validate";

const ok: EntryInput = {
  entry_type: "expense",
  amount: "180",
  main_category: "餐飲",
  sub_category: "",
  account_id: "cash",
  transfer_account_id: "",
  entry_date: "2026-10-28",
  notes: "",
};
const errorsFor = (p: Partial<EntryInput>) => {
  const r = validateEntryInput({ ...ok, ...p });
  return r.ok ? {} : r.errors;
};

describe("amount", () => {
  it.each([
    ["", "請輸入金額"],
    ["   ", "請輸入金額"],
    ["0", "金額必須大於 0"],
    ["-5", "金額必須大於 0"],
    ["△5", "金額必須大於 0"],
    ["abc", "請輸入數字"],
    ["1e5", "請輸入數字"],
    ["1,000,000,000", "金額太大"],
    ["99999999999999999999", "金額太大"],
    ["12.555", "最多兩位小數"],
  ])("rejects %j with %s", (amount, message) => {
    expect(errorsFor({ amount }).amount).toBe(message);
  });

  it("accepts thousands separators and two decimals", () => {
    const r = validateEntryInput({ ...ok, amount: "1,500.25" });
    expect(r.ok && r.value.amount).toBe(1500.25);
  });
});

describe("categories and accounts", () => {
  it("requires a category for expense and income", () => {
    expect(errorsFor({ main_category: "" }).main_category).toBe("請選擇科目");
    expect(errorsFor({ entry_type: "income", main_category: "" }).main_category).toBe("請選擇科目");
  });
  it("a transfer needs different accounts and no category", () => {
    const t = { entry_type: "transfer" as const, main_category: "", account_id: "cash", transfer_account_id: "bank" };
    expect(errorsFor(t)).toEqual({});
    expect(errorsFor({ ...t, transfer_account_id: "cash" }).transfer_account_id).toBe("轉出與轉入不能是同一個帳戶");
    expect(errorsFor({ ...t, transfer_account_id: "" }).transfer_account_id).toBe("請選擇轉入帳戶");
    expect(errorsFor({ ...t, account_id: "" }).account_id).toBe("請選擇轉出帳戶");
  });
  it("normalizes what gets stored", () => {
    const t = validateEntryInput({ ...ok, entry_type: "transfer", main_category: "餐飲", account_id: "cash", transfer_account_id: "bank" });
    expect(t.ok && t.value).toMatchObject({ main_category: "轉帳", sub_category: "other", account_id: "cash", transfer_account_id: "bank" });
    const e = validateEntryInput({ ...ok, sub_category: "一般", transfer_account_id: "ignored" });
    expect(e.ok && e.value).toMatchObject({ sub_category: "other", transfer_account_id: null });
    const none = validateEntryInput({ ...ok, account_id: "" });
    expect(none.ok && none.value.account_id).toBeNull();
  });
});

describe("date and notes", () => {
  it.each(["", "2026-02-30", "2026/10/28", "26-10-28", "2026-13-01"])("rejects date %j", (entry_date) => {
    expect(errorsFor({ entry_date }).entry_date).toBe("日期不正確");
  });
  it("accepts a leap day", () => {
    expect(errorsFor({ entry_date: "2028-02-29" })).toEqual({});
  });
  it("limits notes to 200 characters and stores blank as null", () => {
    expect(errorsFor({ notes: "字".repeat(201) }).notes).toBe("備註最多 200 字");
    expect(errorsFor({ notes: "字".repeat(200) })).toEqual({});
    const r = validateEntryInput({ ...ok, notes: "   " });
    expect(r.ok && r.value.notes).toBeNull();
  });
  it("trims notes", () => {
    const r = validateEntryInput({ ...ok, notes: "  午餐  " });
    expect(r.ok && r.value.notes).toBe("午餐");
  });
});

describe("collects every error at once", () => {
  it("reports amount, category and date together", () => {
    expect(Object.keys(errorsFor({ amount: "", main_category: "", entry_date: "x" })).sort()).toEqual(["amount", "entry_date", "main_category"]);
  });
});

describe("validateBudgetInput", () => {
  const ok = { main_category: "餐飲", year: 2026, month: 10, amount: "6,000", warning_threshold: 0.8 };
  it("accepts a normal budget", () => {
    const r = validateBudgetInput(ok);
    expect(r.ok && r.value).toMatchObject({ main_category: "餐飲", amount: 6000, warning_threshold: 0.8 });
  });
  it.each([["abc", "請輸入數字"], ["-1", "金額必須大於 0"], ["0", "金額必須大於 0"], ["", "請輸入金額"], ["1,000,000,000", "金額太大"]])("amount %j", (amount, message) => {
    const r = validateBudgetInput({ ...ok, amount });
    expect(!r.ok && r.errors.amount).toBe(message);
  });
  it.each([0, -0.1, 1.01, NaN])("threshold %j is rejected", (warning_threshold) => {
    const r = validateBudgetInput({ ...ok, warning_threshold });
    expect(!r.ok && r.errors.warning_threshold).toBe("提醒比例要在 1% 到 100% 之間");
  });
  it("threshold of exactly 1 is allowed", () => {
    expect(validateBudgetInput({ ...ok, warning_threshold: 1 }).ok).toBe(true);
  });
  it("needs a category and a real month", () => {
    expect(!validateBudgetInput({ ...ok, main_category: " " }).ok).toBe(true);
    expect(!validateBudgetInput({ ...ok, month: 13 }).ok).toBe(true);
  });
});

describe("validateAccountInput", () => {
  const ok = { kind: "bank" as const, name: "郵局", opening_balance: "61,880", opening_date: "2026-10-01" };
  it("accepts a normal account, trimming the name", () => {
    const r = validateAccountInput({ ...ok, name: "  郵局 " });
    expect(r.ok && r.value).toEqual({ kind: "bank", name: "郵局", opening_balance: 61880, opening_date: "2026-10-01" });
  });
  it("a credit card opens negative (△), zero is allowed", () => {
    const r = validateAccountInput({ ...ok, kind: "credit_card", opening_balance: "△3,150" });
    expect(r.ok && r.value.opening_balance).toBe(-3150);
    const z = validateAccountInput({ ...ok, opening_balance: "0" });
    expect(z.ok && z.value.opening_balance).toBe(0);
  });
  it("rejects blank names, non-numeric balances and bad dates", () => {
    expect(validateAccountInput({ ...ok, name: "   " })).toEqual({ ok: false, errors: { name: "請輸入帳戶名稱" } });
    expect(validateAccountInput({ ...ok, opening_balance: "abc" })).toEqual({ ok: false, errors: { opening_balance: "請輸入數字" } });
    expect(validateAccountInput({ ...ok, opening_balance: "" })).toEqual({ ok: false, errors: { opening_balance: "請輸入數字" } });
    expect(validateAccountInput({ ...ok, opening_date: "2026-02-30" })).toEqual({ ok: false, errors: { opening_date: "日期不正確" } });
  });
  it("names are limited to 20 characters", () => {
    expect(validateAccountInput({ ...ok, name: "字".repeat(21) })).toEqual({ ok: false, errors: { name: "名稱最多 20 字" } });
  });
});

import { validateRecurringInput, validateRuleInput } from "./validate";

describe("validateRecurringInput", () => {
  const ok = { label: "房租", entry_type: "expense" as const, main_category: "居住", sub_category: "房租", amount_min: "12,000", amount_max: "", due_day: "5" };
  it("accepts a rule and defaults max to min", () => {
    const v = validateRecurringInput(ok, 2026);
    expect(v).toEqual({
      ok: true,
      value: { label: "房租", entry_type: "expense", main_category: "居住", sub_category: "房租", amount_twd_min: 12000, amount_twd_max: 12000, start_date: "2026-01-05" },
    });
  });
  it("keeps due day 31 representable", () => {
    const v = validateRecurringInput({ ...ok, due_day: "31" }, 2026);
    expect(v.ok && v.value.start_date).toBe("2026-01-31");
  });
  it.each([
    [{ label: " " }, "label"],
    [{ main_category: "" }, "main_category"],
    [{ amount_min: "abc" }, "amount_min"],
    [{ amount_min: "0" }, "amount_min"],
    [{ amount_min: "100", amount_max: "50" }, "amount_max"],
    [{ due_day: "0" }, "due_day"],
    [{ due_day: "32" }, "due_day"],
    [{ due_day: "1.5" }, "due_day"],
  ])("rejects %j at %s", (patch, field) => {
    const v = validateRecurringInput({ ...ok, ...patch }, 2026);
    expect(!v.ok && v.errors[field as keyof typeof v.errors]).toBeTruthy();
  });
});

describe("validateRecurringInput blank amounts", () => {
  it("reports a missing amount once, on the minimum, not again on the blank maximum", () => {
    const v = validateRecurringInput({ label: "房租", entry_type: "expense", main_category: "居住", sub_category: "房租", amount_min: "", amount_max: "", due_day: "5" }, 2026);
    expect(!v.ok && v.errors.amount_min).toBe("請輸入金額");
    expect(!v.ok && v.errors.amount_max).toBeUndefined();
  });
});

describe("validateRuleInput", () => {
  const ok = { keyword: " 全聯 ", entry_type: "expense" as const, main_category: "日用購物", sub_category: "" };
  it("trims the keyword and stores the default sub as other", () => {
    expect(validateRuleInput(ok)).toEqual({ ok: true, value: { keyword: "全聯", entry_type: "expense", main_category: "日用購物", sub_category: "other" } });
  });
  it.each([[{ keyword: "  " }, "keyword"], [{ keyword: "a".repeat(31) }, "keyword"], [{ main_category: "" }, "main_category"]])("rejects %j", (patch, field) => {
    const v = validateRuleInput({ ...ok, ...patch });
    expect(!v.ok && v.errors[field as keyof typeof v.errors]).toBeTruthy();
  });
});

describe("currency", () => {
  it("defaults to TWD and accepts USD and JPY", () => {
    const r = (currency?: string) => validateEntryInput({ ...ok, currency });
    expect(r()).toMatchObject({ ok: true, value: { currency: "TWD" } });
    expect(r("JPY")).toMatchObject({ ok: true, value: { currency: "JPY" } });
    expect(errorsFor({ currency: "EUR" }).currency).toBe("幣別不正確");
  });
  it("a transfer is TWD only", () => {
    expect(errorsFor({ entry_type: "transfer", currency: "USD", account_id: "a", transfer_account_id: "b" }).currency).toBe("轉帳只能用台幣");
  });
});
