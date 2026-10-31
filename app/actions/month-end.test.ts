import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "@/lib/domain/types";

const upsertPlans = vi.fn();
let budgets: Record<string, { main_category: string; budget_amount: number; rollover_amount: number; warning_threshold: number }[]> = {};
let entries: Entry[] = [];
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getUserId: async () => "u1" }));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => ({}) }));
vi.mock("@/lib/server/repos/entries", () => ({ listEntries: async () => entries }));
vi.mock("@/lib/server/repos/budgets", () => ({
  listBudgets: async (_c: unknown, _u: string, y: number, m: number) => budgets[`${y}-${m}`] ?? [],
  upsertPlans: (...a: unknown[]) => upsertPlans(...a),
}));

import { closeMonth } from "./month-end";

const b = (main_category: string, budget_amount: number, rollover_amount = 0, warning_threshold = 0.8) => ({ main_category, budget_amount, rollover_amount, warning_threshold });
const spend = (main_category: string, amount: number, entry_date = "2026-12-05"): Entry => ({ id: main_category + amount, entry_type: "expense", main_category, sub_category: null, amount, currency: "TWD", entry_date, notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false });

beforeEach(() => {
  upsertPlans.mockReset();
  budgets = {};
  entries = [];
});

describe("closeMonth", () => {
  it("carries what is left into next month, across the year end, and creates the plan that is missing", async () => {
    budgets = { "2026-12": [b("餐飲", 1000, 100), b("交通", 500, 0, 0.9)], "2027-1": [b("餐飲", 1200, 0, 0.7)] };
    entries = [spend("餐飲", 400), spend("交通", 800)];
    expect(await closeMonth({ year: 2026, month: 12 })).toEqual({ ok: true, carried: 2, created: 1 });
    expect(upsertPlans).toHaveBeenCalledWith({}, "u1", 2027, 1, [
      { main_category: "餐飲", budget_amount: 1200, warning_threshold: 0.7, rollover_amount: 700 }, // keeps next month's own amount and threshold
      { main_category: "交通", budget_amount: 500, warning_threshold: 0.9, rollover_amount: -300 }, // overspent carries as negative
    ]);
  });
  it("running it again replaces the carried amount instead of adding to it", async () => {
    budgets = { "2026-12": [b("餐飲", 1000)], "2027-1": [b("餐飲", 1000, 600)] };
    entries = [spend("餐飲", 400)];
    await closeMonth({ year: 2026, month: 12 });
    expect(upsertPlans.mock.calls[0][4][0].rollover_amount).toBe(600);
  });
  it("says so when there is no budget, and rejects a bad month without touching anything", async () => {
    expect(await closeMonth({ year: 2026, month: 12 })).toMatchObject({ ok: false, error: expect.stringContaining("沒有設定預算") });
    expect(await closeMonth({ year: 2026, month: 13 })).toMatchObject({ ok: false });
    expect(upsertPlans).not.toHaveBeenCalled();
  });
});
