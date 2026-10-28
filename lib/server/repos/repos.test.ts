import { describe, expect, it } from "vitest";
import { insertAccount, listAccounts, setAccountArchived } from "./accounts";
import { copyBudgetsFromPrevious, deleteBudget, listBudgets, normalizeThreshold, upsertBudget } from "./budgets";
import { categoryUsage, renameOrMergeCategory } from "./categories";
import { fakeClient } from "./fake-client";
import { listReconciliations } from "./reconciliations";

describe("every repo query carries user_id", () => {
  it("accounts, budgets, reconciliations", async () => {
    for (const run of [
      (c: ReturnType<typeof fakeClient>["client"]) => listAccounts(c, "u1"),
      (c: ReturnType<typeof fakeClient>["client"]) => listBudgets(c, "u1", 2026, 10),
      (c: ReturnType<typeof fakeClient>["client"]) => listReconciliations(c, "u1", "a1"),
    ]) {
      const { client, calls } = fakeClient();
      await run(client);
      expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    }
  });
});

describe("listBudgets", () => {
  it("reads only the month's TWD main-category rows", async () => {
    const { client, calls } = fakeClient();
    await listBudgets(client, "u1", 2026, 10);
    expect(calls).toContainEqual(["eq", "period_year", 2026]);
    expect(calls).toContainEqual(["eq", "period_month", 10]);
    expect(calls).toContainEqual(["eq", "currency", "TWD"]);
    expect(calls).toContainEqual(["eq", "sub_category", "other"]);
  });
  it("fills null rollover and threshold", async () => {
    const { client } = fakeClient([{ main_category: "餐飲", budget_amount: "5000", rollover_amount: null, warning_threshold: null }]);
    expect(await listBudgets(client, "u1", 2026, 10)).toEqual([
      { main_category: "餐飲", budget_amount: 5000, rollover_amount: 0, warning_threshold: 0.8 },
    ]);
  });
});

describe("normalizeThreshold", () => {
  it.each([[null, 0.8], [0.9, 0.9], [1, 1], [80, 0.8], ["0.75", 0.75], [0, 0.8], [-1, 0.8]])("%j -> %j", (raw, want) => {
    expect(normalizeThreshold(raw as number | string | null)).toBe(want);
  });
});

import { listAllReconciliations } from "./reconciliations";

describe("listAllReconciliations", () => {
  it("is scoped to the user and maps numbers", async () => {
    const { client, calls } = fakeClient([{ account_id: "a1", statement_date: "2026-10-20", statement_balance: "-2830", book_balance: "-3150", diff: "-320", created_at: "2026-10-20T01:00:00Z" }]);
    expect(await listAllReconciliations(client, "u1")).toEqual([
      { account_id: "a1", created_at: "2026-10-20T01:00:00Z", statement_date: "2026-10-20", statement_balance: -2830, book_balance: -3150, diff: -320 },
    ]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
  });
});

import { insertReconciliation } from "./reconciliations";

describe("insertReconciliation", () => {
  it("stamps the user and never sends the generated diff column", async () => {
    const { client, calls } = fakeClient();
    await insertReconciliation(client, "u1", { account_id: "a1", statement_date: "2026-10-29", statement_balance: -2830, book_balance: -3150 });
    const ins = calls.find((c) => c[0] === "insert")?.[1] as Record<string, unknown>;
    expect(ins).toMatchObject({ user_id: "u1", account_id: "a1", statement_balance: -2830, book_balance: -3150 });
    expect(ins).not.toHaveProperty("diff");
  });
});

describe("budget writes", () => {
  it("upsert is keyed on the unique constraint and never sends rollover_amount", async () => {
    const { client, calls } = fakeClient();
    await upsertBudget(client, "u1", { main_category: "餐飲", year: 2026, month: 10, amount: 6000, warning_threshold: 0.8 });
    const [, row, opts] = calls.find((c) => c[0] === "upsert")!;
    expect(row).toMatchObject({ user_id: "u1", main_category: "餐飲", sub_category: "other", currency: "TWD", budget_amount: 6000, period_year: 2026, period_month: 10 });
    expect(row).not.toHaveProperty("rollover_amount");
    expect(opts).toEqual({ onConflict: "user_id,period_year,period_month,main_category,sub_category" });
  });
  it("delete is scoped to the user, month and the main-category TWD row", async () => {
    const { client, calls } = fakeClient();
    await deleteBudget(client, "u1", { main_category: "餐飲", year: 2026, month: 10 });
    for (const c of [["eq", "user_id", "u1"], ["eq", "period_month", 10], ["eq", "sub_category", "other"], ["eq", "currency", "TWD"]]) expect(calls).toContainEqual(c);
  });
  it("copy does nothing when the target month already has budgets", async () => {
    const { client, calls } = fakeClient([{ main_category: "餐飲", budget_amount: 1, rollover_amount: 0, warning_threshold: 0.8 }]);
    expect(await copyBudgetsFromPrevious(client, "u1", { year: 2026, month: 9 }, { year: 2026, month: 10 })).toBe(0);
    expect(calls.some((c) => c[0] === "upsert")).toBe(false);
  });
});

describe("account writes", () => {
  it("insert stamps the user and appends to the sort order", async () => {
    const { client, calls } = fakeClient([{ id: "a9", kind: "cash", name: "x", opening_balance: 0, opening_date: "2026-01-01", sort_order: 4, archived: false }]);
    // first select (existing accounts) and the insert both resolve to the same fake rows; the id comes back from the insert
    await insertAccount(client, "u1", { kind: "bank", name: "郵局", opening_balance: 100, opening_date: "2026-10-01" });
    expect(calls.find((c) => c[0] === "insert")?.[1]).toMatchObject({ user_id: "u1", name: "郵局", sort_order: 5 });
  });
  it("archive is scoped to the user and reports a miss", async () => {
    const hit = fakeClient([{ id: "a1" }]);
    expect(await setAccountArchived(hit.client, "u1", "a1", true)).toBe(true);
    expect(hit.calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(await setAccountArchived(fakeClient([]).client, "u1", "x", true)).toBe(false);
  });
});

describe("category RPC wrappers", () => {
  it("pass exact parameter names and map counts", async () => {
    const { client, calls } = fakeClient([], null, { entries: 2, budgets: "3", rules: 1, recurring: 0 });
    expect(await categoryUsage(client, "expense", { main: "餐飲", sub: "飲料" })).toEqual({ entries: 2, budgets: 3, rules: 1, recurring: 0 });
    expect(calls).toContainEqual(["rpc", "category_usage", { p_kind: "expense", p_main: "餐飲", p_sub: "飲料" }]);
    await renameOrMergeCategory(client, "expense", { main: "餐飲", sub: null }, { main: "飲食", sub: null });
    expect(calls).toContainEqual(["rpc", "rename_or_merge_category", { p_kind: "expense", p_from_main: "餐飲", p_from_sub: null, p_to_main: "飲食", p_to_sub: null }]);
  });
  it("surfaces an RPC error", async () => {
    await expect(categoryUsage(fakeClient([], { message: "boom" }).client, "income", { main: "x", sub: null })).rejects.toThrow("boom");
  });
});
