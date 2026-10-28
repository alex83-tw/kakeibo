import { createServerClient } from "./supabase";

export function resolveUserId(input: {
  sessionUserId: string | null;
  env: { NODE_ENV: string; KAKEIBO_DEV_USER_ID?: string };
}): string {
  if (input.sessionUserId) return input.sessionUserId;
  const dev = input.env.KAKEIBO_DEV_USER_ID?.trim();
  // The dev bypass exists only when NODE_ENV is exactly "development".
  if (input.env.NODE_ENV === "development" && dev) return dev;
  throw new Error("UNAUTHENTICATED");
}

/** The signed-in user's id, verified with the Auth server (not just read from the cookie). */
export async function getUserId(): Promise<string> {
  const client = await createServerClient();
  const { data } = await client.auth.getUser();
  return resolveUserId({
    sessionUserId: data.user?.id ?? null,
    env: { NODE_ENV: process.env.NODE_ENV, KAKEIBO_DEV_USER_ID: process.env.KAKEIBO_DEV_USER_ID },
  });
}
