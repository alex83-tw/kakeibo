/** The app's own origin, from server config — never from request headers (a forged Host would poison the magic link). */
export function siteUrl(env: { NODE_ENV: string; NEXT_PUBLIC_SITE_URL?: string; PORT?: string }): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    if (!/^https?:\/\/[^/\s]+$/.test(configured.replace(/\/$/, ""))) {
      throw new Error("NEXT_PUBLIC_SITE_URL must be an http(s) origin such as https://kakeibo.example.com");
    }
    return configured.replace(/\/$/, "");
  }
  if (env.NODE_ENV === "development") return `http://localhost:${env.PORT ?? 3000}`;
  throw new Error("NEXT_PUBLIC_SITE_URL is not set");
}
