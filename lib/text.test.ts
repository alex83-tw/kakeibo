import { describe, expect, it } from "vitest";
import { foldWidth, pathOf } from "./text";

describe("foldWidth", () => {
  it("folds full-width letters and digits", () => {
    expect(foldWidth("Ｂｕｒｇｅｒ ＨＥ １２")).toBe("Burger HE 12");
  });
  it("keeps CJK text and full-width punctuation as typed", () => {
    expect(foldWidth("午餐，拉麵。")).toBe("午餐，拉麵。");
  });
});

describe("pathOf", () => {
  it("joins segments under /", () => {
    expect(pathOf(undefined)).toBe("/");
    expect(pathOf(["settings", "accounts"])).toBe("/settings/accounts");
  });
  it("keeps a decoded segment from becoming another origin", () => {
    expect(pathOf(["//evil.com"])).toBe("/%2F%2Fevil.com");
    expect(pathOf(["\\evil.com"])).toBe("/%5Cevil.com");
  });
});
