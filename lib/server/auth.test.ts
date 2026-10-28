import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_ID, getUserId } from "./auth";

afterEach(() => vi.unstubAllEnvs());

describe("getUserId", () => {
  it("defaults to the single-user id financial-advisor uses", async () => {
    vi.stubEnv("KAKEIBO_USER_ID", "");
    expect(DEFAULT_USER_ID).toBe("00000000-0000-0000-0000-000000000000");
    expect(await getUserId()).toBe(DEFAULT_USER_ID);
  });
  it("can be overridden by KAKEIBO_USER_ID (trimmed)", async () => {
    vi.stubEnv("KAKEIBO_USER_ID", "  11111111-1111-1111-1111-111111111111 ");
    expect(await getUserId()).toBe("11111111-1111-1111-1111-111111111111");
  });
});
