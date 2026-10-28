"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/server/site-url";
import { createServerClient } from "@/lib/server/supabase";

export async function sendLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/login?error=email");

  const client = await createServerClient();
  // shouldCreateUser: false — only the existing account can sign in; strangers cannot register.
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl(process.env)}/auth/callback` },
  });
  redirect(error ? "/login?error=send" : "/login?sent=1");
}
