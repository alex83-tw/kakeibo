import { describe, expect, it } from "vitest";
import { formatSigned } from "@/lib/money";
import { reconcile, reconcileHint } from "./reconcile";

describe("reconcile", () => {
  it("credit card booked more owed than the statement: 多欠, diff is negative (△)", () => {
    const r = reconcile("credit_card", -3150, -2830);
    expect(r).toEqual({ diff: -320, matched: false, sentence: "帳面比帳單多欠 320" });
    expect(formatSigned(r.diff)).toBe("△320");
  });
  it("credit card booked less owed than the statement: 少欠", () => {
    expect(reconcile("credit_card", -2500, -2830)).toEqual({ diff: 330, matched: false, sentence: "帳面比帳單少欠 330" });
  });
  it("asset accounts say 少 / 多", () => {
    expect(reconcile("bank", 61000, 61880).sentence).toBe("帳面比帳單少 880");
    expect(reconcile("bank", 62000, 61880).sentence).toBe("帳面比帳單多 120");
  });
  it("matches with 對上", () => {
    expect(reconcile("cash", 8200, 8200)).toEqual({ diff: 0, matched: true, sentence: "對上" });
  });
  it("the total row has the same sign as the card (68,270 vs 68,590)", () => {
    expect(reconcile("bank", 68270, 68590).diff).toBe(-320);
  });
  it("compares to two decimals so float noise still matches", () => {
    expect(reconcile("cash", 0.1 + 0.2, 0.3).matched).toBe(true);
  });
});

describe("reconcileHint", () => {
  it("says what the gap probably is, by account type and direction", () => {
    expect(reconcileHint("credit_card", -320)).toBe("可能多記或退款未記");
    expect(reconcileHint("credit_card", 320)).toBe("可能漏記消費");
    expect(reconcileHint("bank", -50)).toBe("可能漏記收入");
    expect(reconcileHint("cash", 50)).toBe("可能漏記支出");
    expect(reconcileHint("e_wallet", 0)).toBe("");
  });
});
