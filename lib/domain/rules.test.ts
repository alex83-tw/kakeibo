import { describe, expect, it } from "vitest";
import type { CategoryRule } from "./recurring";
import { matchRule } from "./rules";

const rule = (keyword: string, main: string, entry_type: CategoryRule["entry_type"] = "expense"): CategoryRule => ({ id: keyword, keyword, entry_type, main_category: main, sub_category: "other" });

describe("matchRule", () => {
  const rules = [rule("全聯", "日用購物"), rule("全聯福利中心", "餐飲"), rule("Uber", "交通"), rule("薪", "薪資", "income")];
  it("finds a rule whose keyword is in the notes, ignoring case", () => {
    expect(matchRule(rules, "uber eats", "expense")?.main_category).toBe("交通");
  });
  it("the longest matching keyword wins", () => {
    expect(matchRule(rules, "全聯福利中心 汐止", "expense")?.main_category).toBe("餐飲");
    expect(matchRule(rules, "全聯 汐止", "expense")?.main_category).toBe("日用購物");
  });
  it("only rules of the same entry type apply", () => {
    expect(matchRule(rules, "十月薪水", "expense")).toBeNull();
    expect(matchRule(rules, "十月薪水", "income")?.main_category).toBe("薪資");
  });
  it("nothing matches blank notes or a blank keyword", () => {
    expect(matchRule(rules, "", "expense")).toBeNull();
    expect(matchRule([rule(" ", "其他")], "anything", "expense")).toBeNull();
  });
});
