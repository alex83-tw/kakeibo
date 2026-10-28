import { describe, expect, it } from "vitest";
import { listAccounts } from "./accounts";
import { listBudgets, normalizeThreshold } from "./budgets";
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
