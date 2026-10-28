import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-request client on the `financial` schema. Like financial-advisor, it uses the service-role key
 * (server-only, never NEXT_PUBLIC) and bypasses RLS; every repo query is scoped by user_id instead.
 */
export async function createServerClient(): Promise<SupabaseClient> {
  // Development-only fixtures (see dev/fixtures.ts); never reachable in a production build.
  if (process.env.NODE_ENV === "development" && process.env.KAKEIBO_DEV_FIXTURES === "1") {
    return (await import("./dev/fixtures")).fixtureClient();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  return createClient(url, key, {
    db: { schema: "financial" },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient;
}
