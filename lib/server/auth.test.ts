import { describe, expect, it } from "vitest";
import { resolveUserId } from "./auth";

describe("resolveUserId", () => {
  it("never accepts the dev bypass in production", () => {
    expect(() =>
      resolveUserId({ sessionUserId: null, env: { NODE_ENV: "production", KAKEIBO_DEV_USER_ID: "dev" } }),
    ).toThrow("UNAUTHENTICATED");
  });
  it("test and unset environments do not get the bypass either", () => {
    for (const NODE_ENV of ["test", ""]) {
      expect(() => resolveUserId({ sessionUserId: null, env: { NODE_ENV, KAKEIBO_DEV_USER_ID: "dev" } })).toThrow("UNAUTHENTICATED");
    }
  });
  it("uses the dev id in development when there is no session", () => {
    expect(resolveUserId({ sessionUserId: null, env: { NODE_ENV: "development", KAKEIBO_DEV_USER_ID: "dev" } })).toBe("dev");
  });
  it("development without a dev id or with a blank one is unauthenticated", () => {
    expect(() => resolveUserId({ sessionUserId: null, env: { NODE_ENV: "development" } })).toThrow("UNAUTHENTICATED");
    expect(() => resolveUserId({ sessionUserId: null, env: { NODE_ENV: "development", KAKEIBO_DEV_USER_ID: "  " } })).toThrow("UNAUTHENTICATED");
  });
  it("a session always wins", () => {
    expect(resolveUserId({ sessionUserId: "me", env: { NODE_ENV: "development", KAKEIBO_DEV_USER_ID: "dev" } })).toBe("me");
    expect(resolveUserId({ sessionUserId: "me", env: { NODE_ENV: "production" } })).toBe("me");
  });
});
