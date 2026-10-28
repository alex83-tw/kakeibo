import { describe, expect, it } from "vitest";
import {
  WEEKDAY_JP,
  currentMonth,
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
