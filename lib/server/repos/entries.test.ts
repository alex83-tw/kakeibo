import { describe, expect, it } from "vitest";
import type { ValidEntry } from "@/lib/domain/validate";
import { insertEntry, listEntries, listRecentEntries, scopedEntries, searchEntries, setEntriesDeleted, setEntryDeleted, updateEntryRow } from "./entries";
import { parseSearchParams } from "@/lib/domain/search";
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

describe("listRecentEntries", () => {
  const row = (id: string) => ({ id, entry_type: "expense", main_category: "餐飲", sub_category: null, amount: "1", currency: "TWD", entry_date: "2026-10-01", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false });
  it("reads only the newest n rows of this user, no exchange-rate query", async () => {
    const { client, calls } = fakeClient([row("b"), row("a")]);
    await listRecentEntries(client, "u1", 2);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["is", "deleted_at", null]);
    expect(calls).toContainEqual(["order", "entry_date", { ascending: false }]);
    expect(calls).toContainEqual(["range", 0, 1]);
    expect(calls.some((c) => c[0] === "from" && c[1] === "exchange_rates")).toBe(false);
  });
  it("returns them oldest-first, the same order as listEntries", async () => {
    const { client } = fakeClient([row("b"), row("a")]);
    expect((await listRecentEntries(client, "u1", 2)).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

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

describe("setEntriesDeleted", () => {
  it("scopes to the user, chunks the ids by 200, and returns the ids that changed", async () => {
    const { client, calls } = fakeClient([{ id: "a" }]);
    const ids = Array.from({ length: 450 }, (_, i) => `e${i}`);
    const changed = await setEntriesDeleted(client, "u1", ids, true);
    const ins = calls.filter((c) => c[0] === "in").map((c) => (c[2] as string[]).length);
    expect(ins).toEqual([200, 200, 50]);
    expect(calls.filter((c) => c[0] === "eq" && c[1] === "user_id")).toHaveLength(3);
    expect(changed).toEqual(["a", "a", "a"]);
  });
  it("delete only touches live rows; restore clears deleted_at without that filter", async () => {
    const del = fakeClient([{ id: "e1" }]);
    await setEntriesDeleted(del.client, "u1", ["e1"], true);
    expect(del.calls).toContainEqual(["is", "deleted_at", null]);
    expect((del.calls.find((c) => c[0] === "update")?.[1] as { deleted_at: string }).deleted_at).toMatch(/^\d{4}-/);
    const res = fakeClient([{ id: "e1" }]);
    await setEntriesDeleted(res.client, "u1", ["e1"], false);
    expect(res.calls.some((c) => c[0] === "is")).toBe(false);
    expect((res.calls.find((c) => c[0] === "update")?.[1] as { deleted_at: null }).deleted_at).toBeNull();
  });
  it("does nothing for an empty list and throws when the query fails", async () => {
    const none = fakeClient([]);
    expect(await setEntriesDeleted(none.client, "u1", [], true)).toEqual([]);
    expect(none.calls).toHaveLength(0);
    await expect(setEntriesDeleted(fakeClient([], { message: "boom" }).client, "u1", ["x"], true)).rejects.toThrow("boom");
  });
});

describe("searchEntries", () => {
  const row = (i: number, p: Record<string, unknown> = {}) => ({ id: `e${i}`, entry_type: "expense", main_category: "餐飲", sub_category: null, amount: 1, currency: "TWD",
    entry_date: "2026-10-01", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...p });
  const filters = (p: Parameters<typeof parseSearchParams>[0] = {}) => parseSearchParams(p);

  it("keeps the user scope, passes only the database-side filters, and reads newest first", async () => {
    const { client, calls } = fakeClient([row(1)]);
    await searchEntries(client, "u1", filters({ type: "income", main: "薪資", from: "2026-01-01", to: "2026-10-31", q: "x", min: "5" }));
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["is", "deleted_at", null]);
    expect(calls).toContainEqual(["eq", "entry_type", "income"]);
    expect(calls).toContainEqual(["eq", "main_category", "薪資"]);
    expect(calls).toContainEqual(["gte", "entry_date", "2026-01-01"]);
    expect(calls).toContainEqual(["lte", "entry_date", "2026-10-31"]);
    expect(calls).toContainEqual(["order", "entry_date", { ascending: false }]);
    expect(calls.some((c) => c[0] === "gte" && c[1] === "amount")).toBe(false);
    expect(calls.some((c) => c[0] === "ilike" || c[0] === "or")).toBe(false);
  });
  it("stops at the cap and says so, without ever asking for more than cap + 1 rows", async () => {
    const { client, calls } = fakeClient(Array.from({ length: 5000 }, (_, i) => row(i)));
    const r = await searchEntries(client, "u1", filters());
    expect(r.entries).toHaveLength(3000);
    expect(r.truncated).toBe(true);
    expect(calls.filter((c) => c[0] === "range")).toEqual([["range", 0, 999], ["range", 1000, 1999], ["range", 2000, 2999], ["range", 3000, 3000]]);
  });
  it("is not truncated when it fits", async () => {
    const { client } = fakeClient(Array.from({ length: 2300 }, (_, i) => row(i)));
    const r = await searchEntries(client, "u1", filters());
    expect(r).toMatchObject({ truncated: false });
    expect(r.entries).toHaveLength(2300);
  });
  it("throws when the query fails", async () => {
    await expect(searchEntries(fakeClient([], { message: "boom" }).client, "u1", filters())).rejects.toThrow("boom");
  });
});

describe("foreign entries and the range a page reads", () => {
  it("convert to the same TWD amount whichever date range is read, even when the latest rate is months older", async () => {
    const { fixtureClient, resetFixtures, FIXTURE_USER } = await import("@/lib/server/dev/fixtures");
    resetFixtures();
    const client = fixtureClient();
    await client.from("exchange_rates").insert([{ from_currency: "JPY", to_currency: "TWD", rate: 0.5, date: "2026-03-01" }]);
    await client.from("accounting_entries").insert([
      { user_id: FIXTURE_USER, entry_type: "expense", main_category: "餐飲", sub_category: "other", amount: 1000, currency: "JPY", entry_date: "2026-10-20", notes: "x", account_id: null, transfer_account_id: null, is_recurring: false },
    ]);
    const month = await listEntries(client, FIXTURE_USER, { start: "2026-10-01", end: "2026-10-31" });
    const year = await listEntries(client, FIXTURE_USER, { start: "2026-01-01", end: "2026-12-31" });
    const pick = (es: { notes: string | null; amount: number }[]) => es.find((e) => e.notes === "x")?.amount;
    expect(pick(month)).toBe(500);
    expect(pick(year)).toBe(500);
  });
});
