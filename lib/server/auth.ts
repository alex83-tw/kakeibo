/** The single user financial-advisor stores everything under (it runs without login). */
export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * kakeibo is single-user and has no login, same as financial-advisor: every query is scoped to
 * this one id, and the server talks to Supabase with the service-role key (see supabase.ts).
 */
export async function getUserId(): Promise<string> {
  return process.env.KAKEIBO_USER_ID?.trim() || DEFAULT_USER_ID;
}
