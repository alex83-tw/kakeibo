import { describe, expect, it } from "vitest";
import { detectRecurring } from "./recurring-detect";
import type { RecurringRule } from "./recurring";
import type { Entry } from "./types";

const e = (entry_date: string, amount: number, p: Partial<Entry> = {}): Entry => ({
  id: `${entry_date}${amount}${p.notes ?? ""}${p.main_category ?? ""}`, entry_type: "expense", main_category: "居住", sub_category: "網路", amount, currency: "TWD", entry_date, notes: "中華電信", account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});
const TODAY = "2026-10-31";
const rule = (p: Partial<RecurringRule> = {}): RecurringRule => ({ id: "r", label: null, entry_type: "expense", main_category: "居住", sub_category: "網路", amount_twd_min: 599, amount_twd_max: 699, frequency: "monthly", anchor_month: null, start_date: "2026-01-05", end_date: null, is_active: true, ...p });
const bill = [e("2026-08-05", 599), e("2026-09-06", 599), e("2026-10-05", 649)];

describe("detectRecurring", () => {
  it("suggests a bill that came once a month, three months running, on about the same day", () => {
    expect(detectRecurring(bill, [], TODAY)).toEqual([{ label: "中華電信", entry_type: "expense", main: "居住", sub: "網路", min: 599, max: 649, day: 5, months: 3, last: "2026-10-05" }]);
  });
  it("needs three months in a row", () => {
    expect(detectRecurring(bill.slice(1), [], TODAY)).toEqual([]);
    expect(detectRecurring([bill[0], bill[2], e("2026-07-05", 599), e("2026-05-05", 599)], [], TODAY)).toEqual([]);
  });
  it("wants the run to end recently", () => {
    expect(detectRecurring(bill, [], "2027-01-31")).toEqual([]);
    expect(detectRecurring(bill, [], "2026-12-31")).toHaveLength(1);
  });
  it("ignores a group with two entries in one month (not a monthly bill) or a day that wanders", () => {
    expect(detectRecurring([...bill, e("2026-10-20", 100)], [], TODAY)).toEqual([]);
    expect(detectRecurring([e("2026-08-02", 599), e("2026-09-15", 599), e("2026-10-28", 599)], [], TODAY)).toEqual([]);
  });
  it("leaves out what an active rule already covers, by category or by name, but not an inactive rule", () => {
    expect(detectRecurring(bill, [rule()], TODAY)).toEqual([]);
    expect(detectRecurring(bill, [rule({ main_category: "其他", sub_category: "other", label: "中華電信" })], TODAY)).toEqual([]);
    expect(detectRecurring(bill, [rule({ is_active: false })], TODAY)).toHaveLength(1);
  });
  it("skips transfers and deleted entries, and names a note-less group by its category", () => {
    expect(detectRecurring(bill.map((x) => ({ ...x, entry_type: "transfer" as const })), [], TODAY)).toEqual([]);
    expect(detectRecurring(bill.map((x, i) => (i === 2 ? { ...x, deleted_at: "x" } : x)), [], TODAY)).toEqual([]);
    expect(detectRecurring(bill.map((x) => ({ ...x, notes: null })), [], TODAY)[0].label).toBe("網路");
  });
  it("cuts a long note to the 20 characters a rule name may have", () => {
    expect(detectRecurring(bill.map((x) => ({ ...x, notes: "很".repeat(30) })), [], TODAY)[0].label).toBe("很".repeat(20));
  });
  it("tells different notes apart and lists the longest-running first", () => {
    const rent = [e("2026-07-02", 12000, { notes: "房租", sub_category: "房租" }), ...["2026-08-02", "2026-09-02", "2026-10-02"].map((d) => e(d, 12000, { notes: "房租", sub_category: "房租" }))];
    const r = detectRecurring([...bill, ...rent], [], TODAY);
    expect(r.map((x) => [x.label, x.months])).toEqual([["房租", 4], ["中華電信", 3]]);
  });
});
