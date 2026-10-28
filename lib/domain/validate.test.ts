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
