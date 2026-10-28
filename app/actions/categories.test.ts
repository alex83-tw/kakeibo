import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient } from "@/lib/server/repos/fake-client";

let fake = fakeClient();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getUserId: async () => "u1" }));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => fake.client }));

import { applyCategoryChange, previewCategoryChange } from "./categories";

const rpcCalls = () => fake.calls.filter((c) => c[0] === "rpc");

beforeEach(() => {
  fake = fakeClient([], null, { entries: 0, budgets: 0, rules: 0, recurring: 0 });
});

describe("applyCategoryChange", () => {
  it("refuses an identical source and target without calling the RPC", async () => {
    const r = await applyCategoryChange("expense", { main: "餐飲", sub: "飲料" }, { main: "餐飲", sub: "飲料" });
    expect(r).toEqual({ ok: false, error: "來源與目標相同" });
    expect(rpcCalls()).toHaveLength(0);
  });
  it("treats 一般 and other as the same sub when comparing", async () => {
    const r = await applyCategoryChange("expense", { main: "餐飲", sub: "other" }, { main: "餐飲", sub: "一般" });
    expect(r).toEqual({ ok: false, error: "來源與目標相同" });
  });
  it("a main-category rename ignores the target sub", async () => {
    await applyCategoryChange("expense", { main: "餐飲", sub: null }, { main: "飲食", sub: "午餐" });
    expect(rpcCalls()[0][2]).toMatchObject({ p_from_sub: null, p_to_main: "飲食", p_to_sub: null });
  });
  it("a sub move needs a target sub, and normalizes 一般 to other", async () => {
    expect(await applyCategoryChange("expense", { main: "餐飲", sub: "飲料" }, { main: "餐飲", sub: "  " })).toMatchObject({ ok: false });
    await applyCategoryChange("expense", { main: "餐飲", sub: "飲料" }, { main: "餐飲", sub: "一般" });
    expect(rpcCalls()[0][2]).toMatchObject({ p_to_sub: "other" });
  });
  it("blank target main and the reserved 轉帳 are rejected", async () => {
    expect(await applyCategoryChange("expense", { main: "餐飲", sub: null }, { main: " ", sub: null })).toMatchObject({ ok: false });
    expect(await applyCategoryChange("expense", { main: "餐飲", sub: null }, { main: "轉帳", sub: null })).toMatchObject({ ok: false });
    expect(rpcCalls()).toHaveLength(0);
  });
  it("returns the RPC's counts", async () => {
    fake = fakeClient([], null, { entries: 5, budgets: 2, rules: 1, recurring: 0, budget_conflicts: 1 });
    expect(await applyCategoryChange("income", { main: "薪資", sub: null }, { main: "工資", sub: null })).toEqual({
      ok: true, entries: 5, budgets: 2, rules: 1, recurring: 0, budget_conflicts: 1,
    });
  });
  it("a database error becomes a message, not a throw", async () => {
    fake = fakeClient([], { message: "boom" });
    expect(await applyCategoryChange("expense", { main: "a", sub: null }, { main: "b", sub: null })).toEqual({ ok: false, error: "變更失敗，請稍後再試" });
  });
});

describe("previewCategoryChange", () => {
  it("a source with nothing in it returns all zeros, not an error", async () => {
    expect(await previewCategoryChange("expense", { main: "不存在", sub: "x" }, { main: "餐飲", sub: "other" })).toEqual({
      ok: true, entries: 0, budgets: 0, rules: 0, recurring: 0,
    });
    expect(rpcCalls()[0][1]).toBe("category_usage");
  });
  it("also refuses an identical source and target", async () => {
    expect(await previewCategoryChange("expense", { main: "a", sub: null }, { main: "a", sub: null })).toEqual({ ok: false, error: "來源與目標相同" });
  });
});
