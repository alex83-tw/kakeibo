import { describe, expect, it } from "vitest";
import { csvTemplate, entriesToCsv, parseEntriesCsv } from "./csv";
import type { Entry, LedgerAccount } from "./types";

const accounts: LedgerAccount[] = [
  { id: "a1", kind: "cash", name: "現金", opening_balance: 0, opening_date: "2026-01-01", sort_order: 0, archived: false },
  { id: "a2", kind: "bank", name: "郵局", opening_balance: 0, opening_date: "2026-01-01", sort_order: 1, archived: false },
];
const entry = (p: Partial<Entry>): Entry => ({
  id: "e",
  entry_type: "expense",
  main_category: "餐飲",
  sub_category: "other",
  amount: 180,
  currency: "TWD",
  entry_date: "2026-10-28",
  notes: null,
  account_id: "a1",
  transfer_account_id: null,
  deleted_at: null,
  is_recurring: false,
  ...p,
});
const HEADER = "日期,類型,科目,子科目,金額,帳戶,轉入帳戶,備註";

describe("entriesToCsv", () => {
  it("writes the fixed header and one line per entry", () => {
    const lines = entriesToCsv([entry({})], accounts).split("\r\n");
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe("2026-10-28,支出,餐飲,一般,180,現金,,");
  });
  it("escapes commas, quotes and newlines in notes", () => {
    const csv = entriesToCsv([entry({ notes: 'a,b "c"\nd' })], accounts);
    expect(csv).toContain('"a,b ""c""\nd"');
  });
  it("keeps a spreadsheet from running a note that starts like a formula, and re-import undoes it", () => {
    const csv = entriesToCsv([entry({ notes: "=HYPERLINK(1)" })], accounts);
    expect(csv.split("\r\n")[1]).toBe("2026-10-28,支出,餐飲,一般,180,現金,,'=HYPERLINK(1)");
    expect(parseEntriesCsv(csv, accounts).rows[0].notes).toBe("=HYPERLINK(1)");
  });
  it("transfer rows carry 轉帳 and the target account", () => {
    const csv = entriesToCsv([entry({ entry_type: "transfer", main_category: "轉帳", account_id: "a1", transfer_account_id: "a2" })], accounts);
    expect(csv.split("\r\n")[1]).toBe("2026-10-28,轉帳,轉帳,一般,180,現金,郵局,");
  });
});

describe("parseEntriesCsv", () => {
  it("round-trips what entriesToCsv writes", () => {
    const src = [
      entry({ notes: 'a,b "c"\nd' }),
      entry({ entry_type: "income", main_category: "薪資", sub_category: "other", amount: 50000.5, entry_date: "2026-10-05" }),
      entry({ entry_type: "transfer", main_category: "轉帳", account_id: "a1", transfer_account_id: "a2" }),
    ];
    const { rows, errors } = parseEntriesCsv(entriesToCsv(src, accounts), accounts);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { entry_type: "expense", amount: "180", main_category: "餐飲", sub_category: "other", account_id: "a1", transfer_account_id: "", entry_date: "2026-10-28", notes: 'a,b "c"\nd' },
      { entry_type: "income", amount: "50000.5", main_category: "薪資", sub_category: "other", account_id: "a1", transfer_account_id: "", entry_date: "2026-10-05", notes: "" },
      { entry_type: "transfer", amount: "180", main_category: "轉帳", sub_category: "other", account_id: "a1", transfer_account_id: "a2", entry_date: "2026-10-28", notes: "" },
    ]);
  });
  it("empty file gives nothing", () => {
    expect(parseEntriesCsv("", accounts)).toEqual({ rows: [], errors: [] });
    expect(parseEntriesCsv(HEADER + "\r\n", accounts)).toEqual({ rows: [], errors: [] });
  });
  it("accepts a BOM and LF line endings", () => {
    const { rows, errors } = parseEntriesCsv(`﻿${HEADER}\n2026-10-28,支出,餐飲,一般,180,現金,,\n`, accounts);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });
  it("reports bad lines with line numbers and keeps good ones", () => {
    const text = [
      HEADER,
      "2026-10-28,支出,餐飲,一般,180,現金,,",
      "2026-10-28,支出,餐飲",
      "2026-10-28,支出,餐飲,一般,abc,現金,,",
      "2026-02-30,支出,餐飲,一般,10,現金,,",
      "2026-10-28,其他,餐飲,一般,10,現金,,",
      "2026-10-28,支出,餐飲,一般,10,不存在,,",
      "2026-10-28,支出,餐飲,一般,10,現金,,",
    ].join("\r\n");
    const { rows, errors } = parseEntriesCsv(text, accounts);
    expect(rows).toHaveLength(2);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
    expect(errors[0].message).toBe("欄位數不對");
    expect(errors[1].message).toBe("請輸入數字");
    expect(errors[2].message).toBe("日期不正確");
    expect(errors[3].message).toBe("類型必須是收入、支出或轉帳");
    expect(errors[4].message).toBe("找不到帳戶「不存在」");
  });
  it("counts line numbers across quoted newlines by record, not by physical line", () => {
    const text = [HEADER, '2026-10-28,支出,餐飲,一般,10,現金,,"a\nb"', "2026-10-28,支出,餐飲,一般,x,現金,,"].join("\r\n");
    expect(parseEntriesCsv(text, accounts).errors[0].line).toBe(3);
  });
  it("rejects a file with the wrong header", () => {
    const { rows, errors } = parseEntriesCsv("a,b,c\r\n1,2,3", accounts);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 1, message: "表頭不正確" }]);
  });
});

import { planImport } from "./csv";

describe("planImport", () => {
  const row = (p: Partial<import("./validate").EntryInput> = {}): import("./validate").EntryInput => ({
    entry_type: "expense",
    amount: "180",
    main_category: "餐飲",
    sub_category: "other",
    account_id: "a1",
    transfer_account_id: "",
    entry_date: "2026-10-28",
    notes: "",
    ...p,
  });

  it("counts a row that matches a live entry as a duplicate", () => {
    const plan = planImport([row()], [entry({})]);
    expect(plan).toEqual({ toAdd: [], duplicates: 1 });
  });
  it("adds rows with no match", () => {
    expect(planImport([row({ amount: "181" })], [entry({})]).toAdd).toHaveLength(1);
  });
  it("each existing entry cancels only one row", () => {
    const plan = planImport([row(), row()], [entry({})]);
    expect(plan.toAdd).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });
  it("ignores soft-deleted entries and other spellings of the default sub", () => {
    expect(planImport([row()], [entry({ deleted_at: "x" })]).toAdd).toHaveLength(1);
    expect(planImport([row({ sub_category: "一般" })], [entry({ sub_category: null })]).duplicates).toBe(1);
  });
  it("matches amounts and notes after the same normalisation validateEntryInput applies", () => {
    expect(planImport([row({ amount: "1,200.00", notes: " 房租 " })], [entry({ amount: 1200, notes: "房租" })]).duplicates).toBe(1);
  });
  it("round-trips: re-importing an export of the same entries adds nothing", () => {
    const entries = [entry({ id: "1" }), entry({ id: "2", entry_type: "transfer", main_category: "轉帳", account_id: "a1", transfer_account_id: "a2" })];
    const { rows } = parseEntriesCsv(entriesToCsv(entries, accounts), accounts);
    expect(planImport(rows, entries)).toEqual({ toAdd: [], duplicates: 2 });
  });
});

describe("csvTemplate", () => {
  it("is a file the importer accepts as is", () => {
    const { rows, errors } = parseEntriesCsv(csvTemplate(), []);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entry_type: "expense", main_category: "餐飲", amount: "120" });
  });
});
