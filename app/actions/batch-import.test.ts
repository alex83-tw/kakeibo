import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry, LedgerAccount } from "@/lib/domain/types";

const revalidatePath = vi.fn();
const insertEntries = vi.fn();
let existing: Entry[] = [];
let accounts: LedgerAccount[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/server/auth", () => ({ getUserId: async () => "u1" }));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => ({}) }));
vi.mock("@/lib/server/repos/accounts", () => ({ listAccounts: async () => accounts }));
vi.mock("@/lib/server/repos/rules", () => ({ listCategoryRules: async () => [{ id: "r1", keyword: "星巴克", entry_type: "expense", main_category: "餐飲", sub_category: "咖啡" }] }));
vi.mock("@/lib/server/repos/entries", () => ({
  listEntries: async () => existing,
  listRecentEntries: async () => [],
  insertEntries: (...a: unknown[]) => insertEntries(...a),
}));

import { applyBatch, previewBatch, type BatchApplyRow } from "./batch-import";

const acct = (id: string, archived = false): LedgerAccount => ({ id, kind: "credit_card", name: id, opening_balance: 0, opening_date: "2026-01-01", sort_order: 0, archived });
const TEXT = ["消費時間\t摘要\t卡號末四碼\t新台幣金額\t消費地\t更多", "2026/10/31 13:39\t星巴克 桃園\t1756\t155\t\t", "2026/10/30 10:09\tUBER\t1756\t634\t\t", "2026/10/30 10:20\t優步退款\t1756\t-619"].join("\n");
const row = (p: Partial<BatchApplyRow> = {}): BatchApplyRow => ({ line: 2, date: "2026-10-31", time: "13:39", merchant: "星巴克", amount: 155, entry_type: "expense", main: "餐飲", sub: "咖啡", keepDuplicate: false, ...p });

beforeEach(() => {
  existing = [];
  accounts = [acct("a1"), acct("old", true)];
  insertEntries.mockReset().mockImplementation(async (_c, _u, values: unknown[]) => values.map((_, i) => `id${i}`));
  revalidatePath.mockClear();
});

describe("previewBatch", () => {
  it("categorises by rule, books a refund as income, and flags what is already in the ledger", async () => {
    existing = [{ id: "e", entry_type: "expense", main_category: "交通", sub_category: "other", amount: 634, currency: "TWD", entry_date: "2026-10-30", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false }];
    const r = await previewBatch(TEXT);
    expect(r).toMatchObject({ ok: true, errors: [] });
    if (!r.ok) throw new Error();
    expect(r.rows.map((x) => [x.merchant, x.amount, x.entry_type, x.main, x.sub, x.duplicate])).toEqual([
      ["星巴克 桃園", 155, "expense", "餐飲", "咖啡", false],
      ["UBER", 634, "expense", "其他", "other", true],
      ["優步退款", 619, "income", "其他", "退款", false],
    ]);
  });
  it("hands back the bad lines and refuses text over the size limit", async () => {
    expect(await previewBatch("nope")).toEqual({ ok: true, rows: [], errors: [{ line: 1, message: expect.stringContaining("日期") }] });
    expect(await previewBatch("x".repeat(1_000_001))).toEqual({ ok: false, error: "檔案太大（上限約 1 MB）" });
  });
});

describe("applyBatch", () => {
  it("writes TWD entries on the chosen account, oldest first, and returns the new ids", async () => {
    const r = await applyBatch("a1", [row({ line: 2 }), row({ line: 3, date: "2026-10-30", time: "10:09", merchant: "UBER", amount: 634, main: "交通", sub: "other" })]);
    expect(r).toEqual({ ok: true, ids: ["id0", "id1"], skipped: 0 });
    const written = insertEntries.mock.calls[0][2] as { entry_date: string; currency: string; account_id: string; amount: number }[];
    expect(written.map((w) => w.entry_date)).toEqual(["2026-10-30", "2026-10-31"]);
    expect(written.every((w) => w.currency === "TWD" && w.account_id === "a1")).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("one day's lines keep the order they happened in even though the bank lists newest first", async () => {
    await applyBatch("", [row({ line: 2, time: "18:33", merchant: "晚" }), row({ line: 3, time: "13:39", merchant: "午" })]);
    const written = insertEntries.mock.calls[0][2] as { notes: string }[];
    expect(written.map((w) => w.notes)).toEqual(["午", "晚"]);
  });
  it("skips rows that are already in the ledger unless the user kept them, re-checked on the server", async () => {
    existing = [{ id: "e", entry_type: "expense", main_category: "餐飲", sub_category: "other", amount: 155, currency: "TWD", entry_date: "2026-10-31", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false }];
    expect(await applyBatch("a1", [row()])).toEqual({ ok: true, ids: [], skipped: 1 });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await applyBatch("a1", [row({ keepDuplicate: true })])).toEqual({ ok: true, ids: ["id0"], skipped: 0 });
  });
  it("rejects an unknown or archived account, an empty batch, and a bad row (naming its line) without writing", async () => {
    expect(await applyBatch("nope", [row()])).toEqual({ ok: false, error: "找不到這個帳戶" });
    expect(await applyBatch("old", [row()])).toEqual({ ok: false, error: "找不到這個帳戶" });
    expect(await applyBatch("a1", [])).toMatchObject({ ok: false });
    const bad = await applyBatch("a1", [row(), row({ line: 7, amount: -5 }), row({ line: 8, date: "2026-02-30" })]);
    expect(bad).toMatchObject({ ok: false, error: expect.stringContaining("第 7 行") });
    expect(insertEntries).not.toHaveBeenCalled();
  });
  it("never writes a transfer or a foreign currency, whatever the client sends", async () => {
    await applyBatch("a1", [{ ...row(), entry_type: "transfer", currency: "JPY" } as unknown as BatchApplyRow]);
    const written = insertEntries.mock.calls[0][2] as { entry_type: string; currency: string }[];
    expect(written[0]).toMatchObject({ entry_type: "expense", currency: "TWD" });
  });
  it("an unarchived account is not required: no account is allowed", async () => {
    expect(await applyBatch("", [row()])).toMatchObject({ ok: true });
  });
});
