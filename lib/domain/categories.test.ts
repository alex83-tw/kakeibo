import { describe, expect, it } from "vitest";
import {
  EXPENSE_TAXONOMY,
  INCOME_TAXONOMY,
  categoryKey,
  isUncategorized,
  normalizeSub,
  subLabel,
} from "./categories";

describe("taxonomy", () => {
  it("has 12 expense and 6 income main categories", () => {
    expect(Object.keys(EXPENSE_TAXONOMY)).toHaveLength(12);
    expect(Object.keys(INCOME_TAXONOMY)).toHaveLength(6);
    expect(Object.keys(EXPENSE_TAXONOMY)).toEqual(
      expect.arrayContaining(["餐飲", "交通", "居住", "日用購物", "醫療保健", "娛樂休閒", "學習成長", "人情社交", "家庭", "保險", "稅費", "其他"]),
    );
    expect(Object.keys(INCOME_TAXONOMY)).toEqual(
      expect.arrayContaining(["薪資", "獎金", "兼職副業", "投資收益", "退稅補助", "其他"]),
    );
  });
  it("has unique subs per main and never lists 一般 (it is the implicit default)", () => {
    for (const tax of [EXPENSE_TAXONOMY, INCOME_TAXONOMY]) {
      for (const subs of Object.values(tax)) {
        expect(new Set(subs).size).toBe(subs.length);
        expect(subs).not.toContain("一般");
      }
    }
  });
  it("has roughly 60 expense subcategories", () => {
    const total = Object.values(EXPENSE_TAXONOMY).reduce((n, s) => n + s.length, 0);
    expect(total).toBeGreaterThanOrEqual(55);
    expect(total).toBeLessThanOrEqual(65);
  });
});

describe("normalizeSub", () => {
  it.each(["", null, undefined, "一般", "other"])("maps %j to other", (v) => {
    expect(normalizeSub(v)).toBe("other");
  });
  it("keeps real subcategories", () => {
    expect(normalizeSub("飲料")).toBe("飲料");
  });
  it("subLabel shows other as 一般", () => {
    expect(subLabel("other")).toBe("一般");
    expect(subLabel("飲料")).toBe("飲料");
  });
});

describe("categoryKey", () => {
  it("is identical for every spelling of the default sub (budget-rules.ts key mismatch)", () => {
    expect(categoryKey("餐飲", "一般")).toBe("餐飲::other");
    expect(categoryKey("餐飲", "other")).toBe("餐飲::other");
    expect(categoryKey("餐飲", null)).toBe("餐飲::other");
  });
});

describe("isUncategorized", () => {
  it("is true for an empty main, or 其他 with the default sub", () => {
    expect(isUncategorized("", "other")).toBe(true);
    expect(isUncategorized("其他", "一般")).toBe(true);
  });
  it("is false once a real sub or main is chosen", () => {
    expect(isUncategorized("其他", "雜項")).toBe(false);
    expect(isUncategorized("餐飲", null)).toBe(false);
  });
});
