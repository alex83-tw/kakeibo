import { describe, expect, it } from "vitest";
import { MAX_AMOUNT, formatAmount, formatSigned, parseAmountInput, roundToTen } from "./money";

describe("parseAmountInput", () => {
  it.each([
    ["1,500", 1500],
    ["△2,830", -2830],
    ["-12", -12],
    ["12.5", 12.5],
  ])("accepts %s", (raw, n) => {
    expect(parseAmountInput(raw)).toBe(n);
  });
  it.each(["12.555", "abc", "", "  ", "1e5", "1,000,000,000", "99999999999999999999"])(
    "rejects %j",
    (raw) => {
      expect(parseAmountInput(raw)).toBeNull();
    },
  );
  it("MAX_AMOUNT itself is accepted", () => {
    expect(parseAmountInput(String(MAX_AMOUNT))).toBe(MAX_AMOUNT);
  });
});

describe("format", () => {
  it("formatAmount uses the absolute value with thousands separators", () => {
    expect(formatAmount(-1500)).toBe("1,500");
    expect(formatAmount(68270)).toBe("68,270");
  });
  it("formatSigned puts △ before negatives only", () => {
    expect(formatSigned(-320)).toBe("△320");
    expect(formatSigned(68270)).toBe("68,270");
  });
  it("roundToTen", () => {
    expect(roundToTen(42536.43)).toBe(42540);
  });
});
