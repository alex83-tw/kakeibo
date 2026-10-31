import { describe, expect, it } from "vitest";
import { categorize, markDuplicates, parseBatchText, REFUND } from "./batch-import";
import type { CategoryRule } from "./recurring";
import type { Entry } from "./types";

const SAMPLE = [
  "消費時間\t摘要\t卡號末四碼\t新台幣金額\t消費地\t更多",
  "2026/10/31 18:33\t暫無資訊\t1756\t255\t\t",
  "2026/10/31 13:39\t星巴克　桃園中山門市\t1756\t155\t\t",
  "2026/10/30 10:09\tUBER\t1756\t634\t\t",
  "2026/10/30 10:09\t優步福爾摩沙股份有限公司\t1756\t-619",
].join("\n");

describe("parseBatchText", () => {
  it("reads the bank's own paste: skips the header, drops the no-info placeholder, keeps a short refund line", () => {
    const { rows, errors } = parseBatchText(SAMPLE);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, date: "2026-10-31", time: "18:33", merchant: "", amount: 255 },
      { line: 3, date: "2026-10-31", time: "13:39", merchant: "星巴克 桃園中山門市", amount: 155 },
      { line: 4, date: "2026-10-30", time: "10:09", merchant: "UBER", amount: 634 },
      { line: 5, date: "2026-10-30", time: "10:09", merchant: "優步福爾摩沙股份有限公司", amount: -619 },
    ]);
  });
  it("accepts CRLF, a BOM, - in dates, no time, thousands commas and decimals; blank lines are ignored", () => {
    const { rows, errors } = parseBatchText("﻿2026-1-5\t全聯\t1756\t1,234.5\r\n\r\n2026/02/03 9:05:11\t咖啡\t1756\t60\r\n");
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.date, r.time, r.amount])).toEqual([["2026-01-05", "", 1234.5], ["2026-02-03", "09:05", 60]]);
  });
  it("falls back to runs of spaces when the paste lost its tabs", () => {
    expect(parseBatchText("2026/10/31 13:39  星巴克  1756  155").rows[0]).toMatchObject({ merchant: "星巴克", amount: 155 });
  });
  it("reports each bad line with its number and keeps the good ones", () => {
    const { rows, errors } = parseBatchText(["hello", "2026/02/30\tx\t1756\t5", "2026/10/31\tx\t1756", "2026/10/31\tx\t1756\tabc", "2026/10/31\tx\t1756\t0", "2026/10/31\tx\t1756\t1.234", "2026/10/31\tok\t1756\t5"].join("\n"));
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(errors[1].message).toContain("日期不存在");
    expect(errors[3].message).toContain("金額看不懂");
  });
  it("strips control characters and a merchant is capped at 200 characters", () => {
    const { rows } = parseBatchText(`2026/10/31\ta\u0000b${"x".repeat(300)}\t1756\t5`);
    expect(rows[0].merchant).toHaveLength(200);
    expect(rows[0].merchant.startsWith("ab")).toBe(true);
  });
  it("an empty paste is nothing, not an error", () => {
    expect(parseBatchText("  \n")).toEqual({ rows: [], errors: [] });
  });
});

const rule = (keyword: string, main: string, sub = "other"): CategoryRule => ({ id: keyword, keyword, entry_type: "expense", main_category: main, sub_category: sub });
const past = (notes: string, main: string, sub = "other", p: Partial<Entry> = {}): Entry => ({
  id: notes, entry_type: "expense", main_category: main, sub_category: sub, amount: 1, currency: "TWD", entry_date: "2026-09-01", notes,
  account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});

describe("categorize", () => {
  it("a refund is income 其他／退款, whatever the rules say", () => {
    expect(categorize({ merchant: "UBER", amount: -619 }, [rule("uber", "交通")], [])).toEqual(REFUND);
  });
  it("a rule wins over history, and the longest keyword wins among rules", () => {
    const rules = [rule("星巴克", "餐飲", "咖啡"), rule("星巴克 桃園", "娛樂休閒")];
    expect(categorize({ merchant: "星巴克 桃園中山門市", amount: 155 }, rules, [past("星巴克", "日用購物")])).toEqual({ entry_type: "expense", main: "娛樂休閒", sub: "other" });
    expect(categorize({ merchant: "星巴克 信義", amount: 155 }, rules, [])).toEqual({ entry_type: "expense", main: "餐飲", sub: "咖啡" });
  });
  it("without a rule it borrows the category of the newest past expense with an overlapping note, either way round", () => {
    const history = [past("統一超商", "餐飲"), past("統一超商－北捷", "交通", "捷運")]; // oldest first
    expect(categorize({ merchant: "統一超商－北捷", amount: 74 }, [], history)).toMatchObject({ main: "交通", sub: "捷運" });
    expect(categorize({ merchant: "統一超商 汐止店", amount: 30 }, [], [past("統一超商", "餐飲")])).toMatchObject({ main: "餐飲" });
    expect(categorize({ merchant: "統一超商", amount: 30 }, [], [past("統一超商－北捷 22:10", "交通")])).toMatchObject({ main: "交通" });
  });
  it("history ignores income, transfers, uncategorised entries and one-character notes", () => {
    const history = [past("咖啡", "薪資", "other", { entry_type: "income" }), past("咖啡", "其他"), past("咖", "餐飲"), past("咖啡", "轉帳", "other", { entry_type: "transfer" })];
    expect(categorize({ merchant: "咖啡", amount: 60 }, [], history)).toEqual({ entry_type: "expense", main: "其他", sub: "other" });
    expect(categorize({ merchant: "咖", amount: 60 }, [], [past("咖", "餐飲")])).toMatchObject({ main: "其他" }); // too short to trust
  });
  it("a blank merchant (the no-info placeholder) is 其他／一般", () => {
    expect(categorize({ merchant: "", amount: 255 }, [rule("a", "餐飲")], [past("x", "餐飲")])).toEqual({ entry_type: "expense", main: "其他", sub: "other" });
  });
});

describe("markDuplicates", () => {
  const row = (date: string, amount: number, entry_type: "expense" | "income" = "expense") => ({ date, amount, entry_type });
  it("flags a row with the same date, type and amount as a live entry", () => {
    expect(markDuplicates([row("2026-10-05", 100), row("2026-10-05", 101), row("2026-10-06", 100), row("2026-10-05", 100, "income")], [past("x", "餐飲", "other", { entry_date: "2026-10-05", amount: 100 })])).toEqual([true, false, false, false]);
  });
  it("each existing entry cancels only one row", () => {
    const existing = [past("a", "餐飲", "other", { entry_date: "2026-10-05", amount: 60 })];
    expect(markDuplicates([row("2026-10-05", 60), row("2026-10-05", 60)], existing)).toEqual([true, false]);
  });
  it("ignores soft-deleted entries and foreign ones (compared by what is stored, so 60 JPY is not 60 TWD)", () => {
    const base = { entry_date: "2026-10-05", amount: 60 };
    expect(markDuplicates([row("2026-10-05", 60)], [past("a", "餐飲", "other", { ...base, deleted_at: "2026-10-06T00:00:00Z" })])).toEqual([false]);
    const jpy = past("b", "餐飲", "other", { ...base, amount: 13, foreign: { currency: "JPY", amount: 60, rate: 0.22 } });
    expect(markDuplicates([row("2026-10-05", 60)], [jpy])).toEqual([false]);
    expect(markDuplicates([row("2026-10-05", 13)], [jpy])).toEqual([false]);
  });
});
