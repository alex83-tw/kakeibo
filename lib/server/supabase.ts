import { createServerClient as createSsrClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
  return { url, key };
}

/** Per-request client on the `financial` schema; RLS applies as the signed-in user. */
export async function createServerClient(): Promise<SupabaseClient> {
  // Development-only fixtures (see dev/fixtures.ts); never reachable in a production build.
  if (process.env.NODE_ENV === "development" && process.env.KAKEIBO_DEV_FIXTURES === "1") {
    return (await import("./dev/fixtures")).fixtureClient();
  }
  const { url, key } = supabaseEnv();
  const store = await cookies();
  return createSsrClient(url, key, {
    db: { schema: "financial" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes the session.
        }
      },
    },
  }) as unknown as SupabaseClient;
}
