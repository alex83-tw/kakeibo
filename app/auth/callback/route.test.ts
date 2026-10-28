import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => ({ auth }) }));

import { GET } from "./route";

const call = (qs: string) => GET(new NextRequest(`http://localhost:3100/auth/callback${qs}`));
const location = (r: Response) => new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3100");
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
});

describe("/auth/callback", () => {
  it("exchanges a PKCE code and goes home", async () => {
    expect(location(await call("?code=abc"))).toBe("/");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });
  it("verifies a token_hash link, which works when the mail is opened in a different browser than the one that asked", async () => {
    expect(location(await call("?token_hash=h1&type=email"))).toBe("/");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "h1", type: "email" });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("accepts only the email type for token_hash", async () => {
    expect(location(await call("?token_hash=h1&type=recovery"))).toBe("/login?error=link");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("sends a failed or missing link back to login", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    expect(location(await call("?token_hash=h1&type=email"))).toBe("/login?error=link");
    expect(location(await call(""))).toBe("/login?error=link");
  });
});
