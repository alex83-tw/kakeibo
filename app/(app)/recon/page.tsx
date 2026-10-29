import { permanentRedirect } from "next/navigation";

/** 對帳 lives with the accounts now. */
export default async function OldRecon({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const { a } = await searchParams;
  permanentRedirect(a ? `/settings/accounts?a=${encodeURIComponent(a)}#recon-form` : "/settings/accounts");
}
