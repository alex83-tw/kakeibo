import { describe, expect, it } from "vitest";
import { formulaGuard, stripControl, unguard } from "./csv-safe";

describe("formulaGuard / unguard", () => {
  it("prefixes only fields a spreadsheet would run", () => {
    for (const s of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx"]) expect(formulaGuard(s)).toBe(`'${s}`);
    for (const s of ["午餐", "12.5", "", "a=b", "'已有引號"]) expect(formulaGuard(s)).toBe(s);
  });
  it("unguard reverses the guard and leaves the user's own apostrophes", () => {
    for (const s of ["=1+1", "+1", "-5 off", "@x"]) expect(unguard(formulaGuard(s))).toBe(s);
    expect(unguard("'已有引號")).toBe("'已有引號");
    expect(unguard("'")).toBe("'");
  });
});

describe("stripControl", () => {
  it("removes control characters and keeps text", () => {
    expect(stripControl("全聯\u0000\t福利\r\n中心\u007f")).toBe("全聯福利中心");
  });
});
