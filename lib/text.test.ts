import { describe, expect, it } from "vitest";
import { foldWidth } from "./text";

describe("foldWidth", () => {
  it("folds full-width letters and digits", () => {
    expect(foldWidth("Ｂｕｒｇｅｒ ＨＥ １２")).toBe("Burger HE 12");
  });
  it("keeps CJK text and full-width punctuation as typed", () => {
    expect(foldWidth("午餐，拉麵。")).toBe("午餐，拉麵。");
  });
});
