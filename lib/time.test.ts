import { describe, expect, it } from "vitest";
import {
  WEEKDAY_JP,
  currentMonth,
  parseMonthParam,
  resolveMonth,
  formatMonthParam,
  shiftMonth,
  dayOfMonth,
  monthRange,
  toKanji,
  twToday,
  weekdayIndex,
} from "./time";

describe("twToday", () => {
  it("treats 00:30 on the 1st in Taiwan as that day even though UTC is still last month", () => {
    expect(twToday(new Date("2026-09-30T16:30:00Z"))).toBe("2026-10-01");
  });
  it("rolls over at 16:00 UTC", () => {
    expect(twToday(new Date("2026-10-01T15:59:00Z"))).toBe("2026-10-01");
    expect(twToday(new Date("2026-10-01T16:00:00Z"))).toBe("2026-10-02");
  });
});

describe("currentMonth", () => {
  it("uses Taiwan time for the month", () => {
    expect(currentMonth(new Date("2026-09-30T16:30:00Z"))).toEqual({ year: 2026, month: 10 });
  });
});

describe("monthRange", () => {
  it("returns inclusive start/end and exclusive nextStart", () => {
    expect(monthRange(2026, 10)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      nextStart: "2026-11-01",
      days: 31,
    });
  });
  it("rolls December into the next year", () => {
    expect(monthRange(2026, 12).nextStart).toBe("2027-01-01");
  });
  it("knows leap years", () => {
    expect(monthRange(2028, 2).days).toBe(29);
    expect(monthRange(2026, 2).days).toBe(28);
  });
});

describe("date parts", () => {
  it("weekdayIndex: 2026-10-28 is Wednesday (3)", () => {
    expect(weekdayIndex("2026-10-28")).toBe(3);
    expect(WEEKDAY_JP[weekdayIndex("2026-10-28")]).toBe("水");
  });
  it("dayOfMonth", () => {
    expect(dayOfMonth("2026-10-01")).toBe(1);
    expect(dayOfMonth("2026-10-28")).toBe(28);
  });
});

describe("toKanji", () => {
  it.each([
    [1, "一"],
    [10, "十"],
    [11, "十一"],
    [20, "二十"],
    [28, "二十八"],
    [31, "三十一"],
  ])("%i -> %s", (n, s) => {
    expect(toKanji(n)).toBe(s);
  });
});

describe("shiftMonth", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonth(2026, 10, -6)).toEqual({ year: 2026, month: 4 });
    expect(shiftMonth(2026, 3, -6)).toEqual({ year: 2025, month: 9 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 });
  });
});

describe("parseMonthParam", () => {
  it("accepts YYYY-MM and rejects everything else", () => {
    expect(parseMonthParam("2026-10")).toEqual({ year: 2026, month: 10 });
    for (const bad of ["", "2026-13", "2026-00", "2026-1", "26-10", "2026/10", "2026-10-01", "abc", "1999-12", "2101-01"]) {
      expect(parseMonthParam(bad)).toBeNull();
    }
  });
});

describe("formatMonthParam", () => {
  it("is the inverse of parseMonthParam", () => {
    expect(formatMonthParam(2026, 9)).toBe("2026-09");
    expect(parseMonthParam(formatMonthParam(2026, 12))).toEqual({ year: 2026, month: 12 });
  });
});

describe("resolveMonth", () => {
  it("uses a valid ?m=, and falls back to this month for anything else", () => {
    expect(resolveMonth("2026-09")).toEqual({ year: 2026, month: 9 });
    for (const bad of [undefined, "", "garbage", "2026-13", ["2026-09"]]) expect(resolveMonth(bad)).toEqual(currentMonth());
  });
});

describe("isRealDate", () => {
  it("only real calendar dates", async () => {
    const { isRealDate } = await import("./time");
    expect(isRealDate("2026-10-29")).toBe(true);
    expect(isRealDate("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "2026-1-1", "x", "2026-10-29x"]) expect(isRealDate(bad)).toBe(false);
  });
});
