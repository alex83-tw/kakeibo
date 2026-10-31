import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const upsertRates = vi.fn();
const deleteRateDay = vi.fn();
const fetchDailyRates = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/server/auth", () => ({ getUserId: async () => "u1" }));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => ({}) }));
vi.mock("@/lib/server/repos/rates", () => ({ upsertRates: (...a: unknown[]) => upsertRates(...a), deleteRateDay: (...a: unknown[]) => deleteRateDay(...a) }));
vi.mock("@/lib/server/yahoo-fx", () => ({ fetchDailyRates: (...a: unknown[]) => fetchDailyRates(...a) }));

import { removeRate, saveRate, syncRates } from "./rates";

beforeEach(() => {
  revalidatePath.mockClear();
  upsertRates.mockReset().mockResolvedValue(undefined);
  deleteRateDay.mockReset().mockResolvedValue(true);
  fetchDailyRates.mockReset();
});

describe("saveRate", () => {
  it("writes both directions as a manual rate and refreshes the pages", async () => {
    expect(await saveRate({ currency: "USD", date: "2026-01-02", rate: "32" })).toEqual({ ok: true });
    expect(upsertRates.mock.calls[0][1]).toEqual([
      { from_currency: "USD", to_currency: "TWD", rate: 32, date: "2026-01-02", source: "manual" },
      { from_currency: "TWD", to_currency: "USD", rate: 0.03125, date: "2026-01-02", source: "manual" },
    ]);
    expect(revalidatePath).toHaveBeenCalled();
  });
  it("answers field errors and writes nothing for bad input", async () => {
    expect(await saveRate({ currency: "EUR", date: "2026-01-02", rate: "32" })).toMatchObject({ ok: false, errors: { currency: expect.any(String) } });
    expect(upsertRates).not.toHaveBeenCalled();
  });
});

describe("removeRate", () => {
  it("reports a day that is not there", async () => {
    deleteRateDay.mockResolvedValue(false);
    expect(await removeRate("USD", "2026-01-02")).toMatchObject({ ok: false, errors: { form: "找不到這筆匯率" } });
    expect(await removeRate("TWD", "2026-01-02")).toMatchObject({ ok: false });
  });
});

describe("syncRates", () => {
  it("rejects a day count outside 1..400", async () => {
    for (const d of [0, 401, 1.5, NaN]) expect(await syncRates(d)).toMatchObject({ ok: false });
    expect(fetchDailyRates).not.toHaveBeenCalled();
  });
  it("saves what Yahoo returned, both directions, and names a currency that failed", async () => {
    fetchDailyRates.mockImplementation(async (c: string) => {
      if (c === "JPY") throw new Error("yahoo 429");
      return [{ date: "2026-10-30", close: 32.1 }, { date: "2026-10-31", close: 32.2 }];
    });
    const r = await syncRates(7);
    expect(r).toEqual({ ok: true, message: "已更新 2 筆（JPY 失敗）" });
    const rows = upsertRates.mock.calls[0][1] as { from_currency: string; source: string }[];
    expect(rows).toHaveLength(4);
    expect(rows.every((x) => x.source === "yahoo-finance")).toBe(true);
  });
  it("writes nothing and says so when every fetch fails", async () => {
    fetchDailyRates.mockRejectedValue(new Error("down"));
    expect(await syncRates(7)).toMatchObject({ ok: false, errors: { form: expect.stringContaining("Yahoo") } });
    expect(upsertRates).not.toHaveBeenCalled();
  });
});
