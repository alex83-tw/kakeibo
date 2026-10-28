import { describe, expect, it } from "vitest";
import { listEntries, scopedEntries } from "./entries";
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
  it("throws when the query fails", async () => {
    const { client } = fakeClient([], { message: "boom" });
    await expect(listEntries(client, "u1", { start: "a", end: "b" })).rejects.toThrow("boom");
  });
});
