"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/server/supabase";

/** Email + password sign-in against the shared Supabase Auth user. No sign-up: strangers cannot register here. */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/login?error=email");
  if (!password) redirect("/login?error=password");

  const client = await createServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  redirect(error ? "/login?error=credentials" : "/");
}
