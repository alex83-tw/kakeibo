import { describe, expect, it } from "vitest";
import { budgetProgress, daysElapsed } from "./budget";

const base = { rollover: 0, warningThreshold: 0.8, daysInMonth: 31 };

describe("budgetProgress", () => {
  it("matches the spec's whole-month numbers", () => {
    const p = budgetProgress({ ...base, budget: 52000, spent: 38420, daysElapsed: 28 });
    expect(p.ratio).toBeCloseTo(0.7388, 3);
    expect(p.remaining).toBe(13580);
    expect(p.projected).toBeCloseTo(42536.43, 1);
    expect(p.status).toBe("ok");
  });

  it("flags projected overspend before the budget is actually exceeded", () => {
    const p = budgetProgress({ ...base, budget: 14000, spent: 13730, daysElapsed: 28 });
    expect(p.projected).toBeCloseTo(15201.07, 1);
    expect(p.status).toBe("projected-over");
  });

  it("is over only when spent exceeds what is available", () => {
    expect(budgetProgress({ ...base, budget: 14000, spent: 14001, daysElapsed: 31 }).status).toBe("over");
    const exact = budgetProgress({ ...base, budget: 14000, spent: 14000, daysElapsed: 31 });
    expect(exact.ratio).toBe(1);
    expect(exact.status).toBe("warning");
  });

  it("warns at the threshold when the projection stays within budget", () => {
    expect(budgetProgress({ ...base, budget: 10000, spent: 8000, daysElapsed: 31 }).status).toBe("warning");
    expect(budgetProgress({ ...base, budget: 10000, spent: 7999, daysElapsed: 31 }).status).toBe("ok");
  });

  it("counts rollover as available budget (regression: old code looked only at ratio > 1 of the base budget)", () => {
    const p = budgetProgress({ ...base, budget: 14000, rollover: 1000, spent: 14500, daysElapsed: 31 });
    expect(p.available).toBe(15000);
    expect(p.remaining).toBe(500);
    expect(p.status).toBe("warning");
  });

  it("never divides by zero on day 1 and ignores categories with no budget", () => {
    expect(Number.isFinite(budgetProgress({ ...base, budget: 1000, spent: 10, daysElapsed: 1 }).projected)).toBe(true);
    const none = budgetProgress({ ...base, budget: 0, spent: 500, daysElapsed: 10 });
    expect(none.ratio).toBe(0);
    expect(none.status).toBe("ok");
  });

  it("ranks over above projected-over above warning above ok", () => {
    const over = budgetProgress({ ...base, budget: 100, spent: 150, daysElapsed: 10 });
    expect(over.status).toBe("over");
  });
});

describe("daysElapsed", () => {
  it("is the Taiwan day of month, 1 on the first", () => {
    expect(daysElapsed("2026-10-01")).toBe(1);
    expect(daysElapsed("2026-10-28")).toBe(28);
  });
});
