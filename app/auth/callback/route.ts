import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/server/site-url";
import { createServerClient } from "@/lib/server/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const client = await createServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", siteUrl(process.env)));
  }
  return NextResponse.redirect(new URL("/login?error=link", siteUrl(process.env)));
}
