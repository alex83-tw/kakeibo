import { describe, expect, it } from "vitest";
import { categoryInventory } from "./inventory";
import type { Entry } from "./types";

const e = (entry_type: Entry["entry_type"], main_category: string, sub_category: string | null, over: Partial<Entry> = {}): Entry => ({
  id: Math.random().toString(), entry_type, main_category, sub_category, amount: 1, currency: "TWD", entry_date: "2026-10-01",
  notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...over,
});

describe("categoryInventory", () => {
  it("lists the taxonomy first, in order, with 一般 first among each main's subs", () => {
    const inv = categoryInventory("expense", []);
    expect(inv[0].main).toBe("餐飲");
    expect(inv[0].subs[0]).toEqual({ sub: "other", count: 0 });
    expect(inv.find((m) => m.main === "餐飲")!.subs.map((s) => s.sub)).toContain("午餐");
  });
  it("counts live entries of that kind only; null sub counts as 一般; transfers and other kinds are ignored", () => {
    const inv = categoryInventory("expense", [
      e("expense", "餐飲", "午餐"), e("expense", "餐飲", "午餐"), e("expense", "餐飲", null),
      e("expense", "餐飲", "午餐", { deleted_at: "x" }), e("income", "餐飲", "午餐"), e("transfer", "轉帳", "other"),
    ]);
    const food = inv.find((m) => m.main === "餐飲")!;
    expect(food.count).toBe(3);
    expect(food.subs.find((s) => s.sub === "午餐")!.count).toBe(2);
    expect(food.subs.find((s) => s.sub === "other")!.count).toBe(1);
    expect(inv.find((m) => m.main === "轉帳")).toBeUndefined();
  });
  it("categories the user typed that are not in the taxonomy are listed after it", () => {
    const inv = categoryInventory("expense", [e("expense", "寵物", "飼料"), e("expense", "寵物", "飼料")]);
    const last = inv.at(-1)!;
    expect(last).toMatchObject({ main: "寵物", count: 2 });
    expect(last.subs).toContainEqual({ sub: "飼料", count: 2 });
  });
  it("income uses its own taxonomy", () => {
    expect(categoryInventory("income", [])[0].main).toBe("薪資");
  });
});

import { inventoryToTaxonomy } from "./inventory";

describe("inventoryToTaxonomy", () => {
  it("lists built-in and renamed categories for the entry form, without the implicit 一般 sub", () => {
    const entries = [
      { id: "1", entry_type: "expense", main_category: "吃喝", sub_category: "午餐", amount: 1, currency: "TWD", entry_date: "2026-10-01", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false },
      { id: "2", entry_type: "expense", main_category: "吃喝", sub_category: null, amount: 1, currency: "TWD", entry_date: "2026-10-02", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false },
    ] as import("./types").Entry[];
    const t = inventoryToTaxonomy("expense", entries);
    expect(t["吃喝"]).toEqual(["午餐"]);
    expect(t["交通"]).toContain("捷運");
    expect(Object.keys(t)).toContain("餐飲");
  });
});
