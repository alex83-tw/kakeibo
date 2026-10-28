import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock("@/lib/server/supabase", () => ({ createServerClient: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { signIn } from "./actions";

const form = (email: string, password: string) => {
  const f = new FormData();
  f.set("email", email);
  f.set("password", password);
  return f;
};
const redirectOf = (p: Promise<unknown>) => p.then(() => "none", (e: Error) => e.message);

beforeEach(() => auth.signInWithPassword.mockReset().mockResolvedValue({ error: null }));

describe("signIn", () => {
  it("signs in with the trimmed email and password, then goes home", async () => {
    expect(await redirectOf(signIn(form(" me@example.com ", "secret12")))).toBe("REDIRECT:/");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "me@example.com", password: "secret12" });
  });

  it("rejects a malformed email without calling Supabase", async () => {
    expect(await redirectOf(signIn(form("nope", "secret12")))).toBe("REDIRECT:/login?error=email");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an empty password without calling Supabase", async () => {
    expect(await redirectOf(signIn(form("me@example.com", "")))).toBe("REDIRECT:/login?error=password");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("reports wrong credentials with one generic error", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await redirectOf(signIn(form("me@example.com", "wrong")))).toBe("REDIRECT:/login?error=credentials");
  });
});
