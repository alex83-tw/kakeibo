import { describe, expect, it } from "vitest";
import { groupByWeek } from "./weeks";

const zeros = (n: number) => Array.from({ length: n }, () => ({ income: 0, expense: 0 }));

describe("groupByWeek", () => {
  it("October 2026: weeks end on Saturday", () => {
    const daily = zeros(31);
    daily[18 - 1].expense = 5000;
    daily[24 - 1].expense = 2970;
    const weeks = groupByWeek(2026, 10, daily);
    expect(weeks.map((w) => [w.start, w.end])).toEqual([[1, 3], [4, 10], [11, 17], [18, 24], [25, 31]]);
    expect(weeks[3].expense).toBe(7970);
  });

  it("week totals add up to the month total", () => {
    const daily = zeros(31).map((_, i) => ({ income: i % 5 === 0 ? 100 : 0, expense: i + 1 }));
    const weeks = groupByWeek(2026, 10, daily);
    expect(weeks.reduce((s, w) => s + w.expense, 0)).toBe(daily.reduce((s, d) => s + d.expense, 0));
    expect(weeks.reduce((s, w) => s + w.income, 0)).toBe(daily.reduce((s, d) => s + d.income, 0));
  });

  it("a month starting on Saturday has a one-day first week", () => {
    // 2026-08-01 is a Saturday
    expect(groupByWeek(2026, 8, zeros(31))[0]).toMatchObject({ start: 1, end: 1 });
  });

  it("a month ending on Saturday has no trailing partial week", () => {
    // 2026-05-31 is a Sunday; 2026-04-30 is a Thursday; 2026-01-31 is a Saturday
    const weeks = groupByWeek(2026, 1, zeros(31));
    expect(weeks.at(-1)).toMatchObject({ start: 25, end: 31 });
  });

  it("February in a leap year", () => {
    const weeks = groupByWeek(2028, 2, zeros(29));
    expect(weeks.at(-1)?.end).toBe(29);
  });
});
