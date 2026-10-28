"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/server/supabase";

export async function sendLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/login?error=email");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  const client = await createServerClient();
  // shouldCreateUser: false — only the existing account can sign in; strangers cannot register.
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${proto}://${host}/auth/callback` },
  });
  redirect(error ? "/login?error=send" : "/login?sent=1");
}
