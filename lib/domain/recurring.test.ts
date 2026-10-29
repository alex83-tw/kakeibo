import { describe, expect, it } from "vitest";
import { anchorMonth, dueRules, ruleName, type RecurringRule } from "./recurring";

const rule = (p: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "r1",
  label: "房租",
  entry_type: "expense",
  main_category: "居住",
  sub_category: "房租",
  amount_twd_min: 12000,
  amount_twd_max: 12000,
  frequency: "monthly",
  anchor_month: null,
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
  it("skips inactive, ended and not-yet-started rules", () => {
    expect(dueRules([rule({ is_active: false })], "2026-10-29")).toEqual([]);
    expect(dueRules([rule({ end_date: "2026-09-30" })], "2026-10-29")).toEqual([]);
    expect(dueRules([rule({ start_date: "2026-11-05" })], "2026-10-29")).toEqual([]);
  });
  it("a quarterly rule is due every third month from its anchor, and only then", () => {
    const q = rule({ frequency: "quarterly", anchor_month: 1 });
    for (const m of ["2026-01-20", "2026-04-20", "2026-07-20", "2026-10-29"]) expect(dueRules([q], m)).toHaveLength(1);
    for (const m of ["2026-02-20", "2026-03-20", "2026-11-29", "2026-12-29"]) expect(dueRules([q], m)).toEqual([]);
  });
  it("an annual rule is due only in its anchor month", () => {
    const a = rule({ frequency: "annual", anchor_month: 10 });
    expect(dueRules([a], "2026-10-29")).toHaveLength(1);
    expect(dueRules([a], "2026-11-29")).toEqual([]);
  });
  it("without an anchor_month the month of start_date is the anchor", () => {
    const q = rule({ frequency: "quarterly", start_date: "2026-01-10" });
    expect(anchorMonth(q)).toBe(1);
    expect(dueRules([q], "2026-10-29")).toHaveLength(1);
    expect(dueRules([q], "2026-11-29")).toEqual([]);
  });
  it("an unknown frequency is never due", () => {
    expect(dueRules([rule({ frequency: "weekly" })], "2026-10-29")).toEqual([]);
  });
});
