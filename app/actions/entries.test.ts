import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient } from "@/lib/server/repos/fake-client";

let fake = fakeClient();
const revalidatePath = vi.fn();
let signedIn = true;
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/server/auth", () => ({
  getUserId: async () => {
    if (!signedIn) throw new Error("UNAUTHENTICATED");
    return "u1";
  },
}));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => fake.client }));

import { restoreEntries, softDeleteEntries } from "./entries";

beforeEach(() => {
  fake = fakeClient([{ id: "a" }, { id: "b" }]);
  signedIn = true;
  revalidatePath.mockClear();
});

describe("softDeleteEntries / restoreEntries", () => {
  it("deletes the selected ids for this user, refreshes the book and returns what changed", async () => {
    const r = await softDeleteEntries(["a", "b", "a"]);
    expect(r).toEqual({ ok: true, ids: ["a", "b"] });
    expect(fake.calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(fake.calls).toContainEqual(["in", "id", ["a", "b"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("restore clears deleted_at", async () => {
    await restoreEntries(["a"]);
    expect((fake.calls.find((c) => c[0] === "update")?.[1] as { deleted_at: null }).deleted_at).toBeNull();
  });
  it("rejects an empty, oversized or malformed selection without touching the database", async () => {
    for (const ids of [[], Array.from({ length: 501 }, (_, i) => `e${i}`), [""], [1 as unknown as string], "a" as unknown as string[]]) {
      expect(await softDeleteEntries(ids)).toMatchObject({ ok: false });
    }
    expect(fake.calls).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("signed out gives a message, a failing query a generic one, and neither refreshes", async () => {
    signedIn = false;
    expect(await softDeleteEntries(["a"])).toEqual({ ok: false, error: "請先登入" });
    signedIn = true;
    fake = fakeClient([], { message: "boom" });
    expect(await softDeleteEntries(["a"])).toEqual({ ok: false, error: "處理失敗，請稍後再試" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
