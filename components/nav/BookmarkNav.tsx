"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDesktop } from "@/components/desktop/useDesktop";

export const BOOKMARKS = [
  { href: "/", label: "今日" },
  { href: "/ledger", label: "帳本" },
  { href: "/recon", label: "對帳" },
  { href: "/settings", label: "設定" },
] as const;

const isCurrent = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** 書籤：掛在頁面上緣的索引籤。每枚點擊區高 44px，作用中的升到與頁面相連。 */
export function BookmarkNav() {
  const pathname = usePathname();
  const desktop = useDesktop();
  // The home page is a two-page spread on desktop and carries its own bookmarks.
  if (desktop && pathname === "/") return null;
  return (
    <nav className="tabs" aria-label="頁面">
      {BOOKMARKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="tab"
          aria-current={isCurrent(pathname, href) ? "page" : undefined}
        >
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
