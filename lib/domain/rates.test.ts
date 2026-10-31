import { describe, expect, it } from "vitest";
import { daysBetween, parseYahooChart, rateRows, validateRateInput } from "./rates";

const TODAY = "2026-10-31";

describe("validateRateInput", () => {
  it("accepts a known currency, a real past date and a positive rate, rounded to 6 decimals", () => {
    expect(validateRateInput({ currency: "JPY", date: "2026-10-30", rate: "0.2134567891" }, TODAY)).toEqual({ ok: true, value: { currency: "JPY", date: "2026-10-30", rate: 0.213457 } });
    expect(validateRateInput({ currency: "USD", date: TODAY, rate: "1,032.5" }, TODAY).ok).toBe(false); // > 1000
    expect(validateRateInput({ currency: "USD", date: TODAY, rate: "31.9" }, TODAY).ok).toBe(true);
  });
  it("rejects TWD, unreal and future dates, and zero / junk rates, each on its own field", () => {
    const r = validateRateInput({ currency: "TWD", date: "2026-02-30", rate: "abc" }, TODAY);
    expect(r).toEqual({ ok: false, errors: { currency: "請選擇幣別", date: "請輸入日期", rate: "請輸入匯率" } });
    expect(validateRateInput({ currency: "USD", date: "2026-11-01", rate: "32" }, TODAY)).toMatchObject({ ok: false, errors: { date: "不能是未來的日期" } });
    expect(validateRateInput({ currency: "USD", date: TODAY, rate: "0" }, TODAY)).toMatchObject({ ok: false, errors: { rate: expect.any(String) } });
  });
});

describe("rateRows", () => {
  it("writes both directions with the same date and source", () => {
    expect(rateRows({ currency: "USD", date: TODAY, rate: 32 }, "manual")).toEqual([
      { from_currency: "USD", to_currency: "TWD", rate: 32, date: TODAY, source: "manual" },
      { from_currency: "TWD", to_currency: "USD", rate: 0.03125, date: TODAY, source: "manual" },
    ]);
  });
});

describe("parseYahooChart", () => {
  it("pairs timestamps with closes and skips null closes", () => {
    const json = { chart: { result: [{ timestamp: [1761868800, 1761955200, 1762041600], indicators: { quote: [{ close: [32.1, null, 32.3] }] } }] } };
    expect(parseYahooChart(json)).toEqual([
      { date: "2025-10-31", close: 32.1 },
      { date: "2025-11-02", close: 32.3 },
    ]);
  });
  it("gives [] for an error body or garbage", () => {
    expect(parseYahooChart({ chart: { result: null, error: { code: "Not Found" } } })).toEqual([]);
    expect(parseYahooChart(null)).toEqual([]);
    expect(parseYahooChart("x")).toEqual([]);
  });
});

describe("daysBetween", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-10-28", TODAY)).toBe(3);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
  });
});
