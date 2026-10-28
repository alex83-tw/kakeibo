import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/server/site-url";
import { createServerClient } from "@/lib/server/supabase";

/**
 * Handles both link styles:
 * - `?code=` (PKCE): only works in the browser that asked for the link.
 * - `?token_hash=&type=email`: works from any browser (a mail app's in-app browser, another device). Needs the
 *   Supabase "Magic Link" email template to point at `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const client = await createServerClient();

  let ok = false;
  if (code) {
    ok = !(await client.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && params.get("type") === "email") {
    ok = !(await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" })).error;
  }
  return NextResponse.redirect(new URL(ok ? "/" : "/login?error=link", siteUrl(process.env)));
}
