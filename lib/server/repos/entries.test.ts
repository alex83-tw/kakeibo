import { describe, expect, it } from "vitest";
import type { ValidEntry } from "@/lib/domain/validate";
import { insertEntry, listEntries, scopedEntries, setEntryDeleted, updateEntryRow } from "./entries";
import { fakeClient } from "./fake-client";

describe("scopedEntries", () => {
  it("always filters by user and hides soft-deleted rows", () => {
    const { client, calls } = fakeClient();
    scopedEntries(client, "u1");
    expect(calls).toContainEqual(["from", "accounting_entries"]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["is", "deleted_at", null]);
  });
});

describe("listEntries", () => {
  it("adds an inclusive date range and keeps the user scope", async () => {
    const { client, calls } = fakeClient();
    await listEntries(client, "u1", { start: "2026-10-01", end: "2026-10-31" });
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["is", "deleted_at", null]);
    expect(calls).toContainEqual(["gte", "entry_date", "2026-10-01"]);
    expect(calls).toContainEqual(["lte", "entry_date", "2026-10-31"]);
  });
  it("returns domain entries with numeric amounts", async () => {
    const { client } = fakeClient([
      { id: "e1", entry_type: "expense", main_category: "餐飲", sub_category: null, amount: "180.50", currency: "TWD",
        entry_date: "2026-10-28", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: null },
    ]);
    const [e] = await listEntries(client, "u1", { start: "2026-10-01", end: "2026-10-31" });
    expect(e.amount).toBe(180.5);
    expect(e.is_recurring).toBe(false);
  });
  it("pages past PostgREST's 1000-row cap instead of silently truncating", async () => {
    const row = (i: number) => ({ id: `e${i}`, entry_type: "expense", main_category: "餐飲", sub_category: null, amount: 1, currency: "TWD",
      entry_date: "2026-10-01", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false });
    const { client, calls } = fakeClient(Array.from({ length: 2300 }, (_, i) => row(i)));
    const all = await listEntries(client, "u1", { start: "2026-01-01", end: "2026-12-31" });
    expect(all).toHaveLength(2300);
    expect(calls.filter((c) => c[0] === "range")).toEqual([["range", 0, 999], ["range", 1000, 1999], ["range", 2000, 2999]]);
  });
  it("throws when the query fails", async () => {
    const { client } = fakeClient([], { message: "boom" });
    await expect(listEntries(client, "u1", { start: "a", end: "b" })).rejects.toThrow("boom");
  });
});

const valid: ValidEntry = {
  entry_type: "expense", amount: 180, currency: "TWD", main_category: "餐飲", sub_category: "other",
  account_id: null, transfer_account_id: null, entry_date: "2026-10-28", notes: null,
};

describe("entry writes", () => {
  it("insert stamps the user and writes the entry\u2019s currency", async () => {
    const { client, calls } = fakeClient([{ id: "new" }]);
    expect(await insertEntry(client, "u1", valid)).toBe("new");
    const ins = calls.find((c) => c[0] === "insert");
    expect(ins?.[1]).toMatchObject({ user_id: "u1", currency: "TWD", amount: 180 });
  });
  it("update writes the currency too, so an edit can change JPY to TWD", async () => {
    const { client, calls } = fakeClient([{ id: "e1" }]);
    await updateEntryRow(client, "u1", "e1", { ...valid, currency: "JPY" });
    expect(calls.find((c) => c[0] === "update")?.[1]).toMatchObject({ currency: "JPY" });
  });
  it("update is scoped to user and live rows, and reports a miss", async () => {
    const hit = fakeClient([{ id: "e1" }]);
    expect(await updateEntryRow(hit.client, "u1", "e1", valid)).toBe(true);
    expect(hit.calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(hit.calls).toContainEqual(["eq", "id", "e1"]);
    expect(hit.calls).toContainEqual(["is", "deleted_at", null]);
    const miss = fakeClient([]);
    expect(await updateEntryRow(miss.client, "u1", "someone-elses", valid)).toBe(false);
  });
  it("soft delete sets a timestamp, restore sets null, both scoped to the user", async () => {
    const del = fakeClient([{ id: "e1" }]);
    await setEntryDeleted(del.client, "u1", "e1", true);
    expect((del.calls.find((c) => c[0] === "update")?.[1] as { deleted_at: string }).deleted_at).toMatch(/^\d{4}-/);
    expect(del.calls).toContainEqual(["eq", "user_id", "u1"]);
    const res = fakeClient([{ id: "e1" }]);
    await setEntryDeleted(res.client, "u1", "e1", false);
    expect((res.calls.find((c) => c[0] === "update")?.[1] as { deleted_at: null }).deleted_at).toBeNull();
    expect(await setEntryDeleted(fakeClient([]).client, "u1", "x", true)).toBe(false);
  });
});
