import { describe, expect, it } from "vitest";
import { dueRules, ruleName, type RecurringRule } from "./recurring";

const rule = (p: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "r1",
  label: "房租",
  entry_type: "expense",
  main_category: "居住",
  sub_category: "房租",
  amount_twd_min: 12000,
  amount_twd_max: 12000,
  frequency: "monthly",
  start_date: "2025-03-05",
  end_date: null,
  is_active: true,
  ...p,
});

describe("ruleName", () => {
  it("prefers the label, then a real sub category, then the main category", () => {
    expect(ruleName(rule())).toBe("房租");
    expect(ruleName(rule({ label: null, sub_category: "網路" }))).toBe("網路");
    expect(ruleName(rule({ label: " ", sub_category: "other" }))).toBe("居住");
  });
});

describe("dueRules", () => {
  it("takes the due day from start_date", () => {
    expect(dueRules([rule()], "2026-10-29")).toEqual([{ id: "r1", name: "房租", due_day: 5, main: "居住", sub: "房租" }]);
  });
  it("skips inactive, ended, not-yet-started and non-monthly rules", () => {
    expect(dueRules([rule({ is_active: false })], "2026-10-29")).toEqual([]);
    expect(dueRules([rule({ end_date: "2026-09-30" })], "2026-10-29")).toEqual([]);
    expect(dueRules([rule({ frequency: "annual" })], "2026-10-29")).toEqual([]);
    expect(dueRules([rule({ start_date: "2026-11-05" })], "2026-10-29")).toEqual([]);
  });
});
