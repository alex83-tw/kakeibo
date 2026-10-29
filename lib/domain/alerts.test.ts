import { describe, expect, it } from "vitest";
import { findAbnormal, findDuplicates, findMissingRecurring, topAlerts, type Alert } from "./alerts";
import type { Entry } from "./types";

let seq = 0;
function entry(p: Partial<Entry>): Entry {
  return {
    id: `e${++seq}`, entry_type: "expense", main_category: "餐飲", sub_category: null, amount: 100, currency: "TWD",
    entry_date: "2026-10-28", notes: null, account_id: "cash", transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
  };
}

describe("findDuplicates", () => {
  it("groups same day, amount, account and main category", () => {
    const a = entry({ amount: 120 });
    const b = entry({ amount: 120 });
    expect(findDuplicates([a, b, entry({ amount: 121 })])).toEqual([[a, b]]);
  });
  it("does not group different days, deleted rows or transfers", () => {
    expect(findDuplicates([entry({}), entry({ entry_date: "2026-10-27" })])).toEqual([]);
    expect(findDuplicates([entry({}), entry({ deleted_at: "x" })])).toEqual([]);
    const t = { entry_type: "transfer" as const, main_category: "轉帳", transfer_account_id: "bank" };
    expect(findDuplicates([entry(t), entry(t)])).toEqual([]);
  });
});

describe("findAbnormal", () => {
  const history = (amount: number, n: number) =>
    Array.from({ length: n }, (_, i) => entry({ amount, entry_date: `2026-0${5 + (i % 5)}-10` }));

  it("flags a single entry at least 3x the category median and at least 1,000", () => {
    const big = entry({ amount: 1600 });
    expect(findAbnormal([...history(500, 5), big], "2026-10-28")).toEqual([big]);
  });
  it("does not flag below 3x or below 1,000", () => {
    expect(findAbnormal([...history(500, 5), entry({ amount: 1400 })], "2026-10-28")).toEqual([]);
    expect(findAbnormal([...history(100, 5), entry({ amount: 400 })], "2026-10-28")).toEqual([]);
  });
  it("needs at least 3 historical entries in the same category", () => {
    expect(findAbnormal([...history(500, 2), entry({ amount: 5000 })], "2026-10-28")).toEqual([]);
    expect(findAbnormal([...history(500, 5).map((e) => ({ ...e, main_category: "交通" })), entry({ amount: 5000 })], "2026-10-28")).toEqual([]);
  });
});

describe("findMissingRecurring", () => {
  const rules = [{ id: "r1", name: "房租", due_day: 5 }];
  it("reports a rule 3+ days past due with no matching entry this month", () => {
    expect(findMissingRecurring(rules, [], "2026-10-08")).toEqual(rules);
  });
  it("waits until 3 days after the due date", () => {
    expect(findMissingRecurring(rules, [], "2026-10-07")).toEqual([]);
  });
  it("is satisfied by a live entry this month that names the rule, not by a deleted or older one", () => {
    expect(findMissingRecurring(rules, [entry({ notes: "房租 10 月", entry_date: "2026-10-05" })], "2026-10-08")).toEqual([]);
    expect(findMissingRecurring(rules, [entry({ notes: "房租", deleted_at: "x", entry_date: "2026-10-05" })], "2026-10-08")).toHaveLength(1);
    expect(findMissingRecurring(rules, [entry({ notes: "房租", entry_date: "2026-09-05" })], "2026-10-08")).toHaveLength(1);
  });
  it("clamps a day-31 rule to the end of a short month", () => {
    expect(findMissingRecurring([{ id: "r2", name: "保費", due_day: 31 }], [], "2026-02-28")).toEqual([]);
  });
});

describe("topAlerts", () => {
  const a = (kind: Alert["kind"], text: string = kind): Alert => ({ kind, text, href: "/" });
  it("orders budget over/projected, warning, reconcile, uncategorized, then the rest", () => {
    const input = [a("abnormal"), a("uncategorized"), a("reconcile"), a("budget-warning"), a("budget-projected"), a("budget-over"), a("duplicate"), a("missing-recurring")];
    expect(topAlerts(input, 8).map((x) => x.kind)).toEqual([
      "budget-over", "budget-projected", "budget-warning", "reconcile", "uncategorized", "duplicate", "abnormal", "missing-recurring",
    ]);
  });
  it("keeps input order within a kind and limits to 3 by default", () => {
    const input = [a("budget-over", "1"), a("budget-over", "2"), a("reconcile"), a("uncategorized")];
    expect(topAlerts(input).map((x) => x.text)).toEqual(["1", "2", "reconcile"]);
  });
});
