import { describe, expect, it } from "vitest";
import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("uses the configured origin and strips a trailing slash", () => {
    expect(siteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://kakeibo.example.com/" })).toBe("https://kakeibo.example.com");
  });
  it("falls back to localhost only in development", () => {
    expect(siteUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(siteUrl({ NODE_ENV: "development", PORT: "3100" })).toBe("http://localhost:3100");
  });
  it("refuses to guess in production or test", () => {
    expect(() => siteUrl({ NODE_ENV: "production" })).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => siteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "  " })).toThrow("NEXT_PUBLIC_SITE_URL");
  });
  it("rejects a value that is not an http(s) origin", () => {
    expect(() => siteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toThrow("NEXT_PUBLIC_SITE_URL");
  });
});
