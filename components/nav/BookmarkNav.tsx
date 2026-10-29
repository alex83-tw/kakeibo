"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parseMonthParam } from "@/lib/time";

export const BOOKMARKS = [
  { href: "/", label: "今日" },
  { href: "/ledger", label: "帳本" },
  { href: "/budget", label: "預算" },
  { href: "/settings", label: "設定" },
] as const;

const isCurrent = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** 書籤：掛在頁面上緣的索引籤。電腦版「帳本」掛在左頁，其餘掛在右頁；每枚都是真的網址。換分頁時帶著 `?m=`，左頁的月份才不會跳回本月。 */
export function BookmarkNav() {
  const pathname = usePathname();
  const m = useSearchParams().get("m");
  const keep = m !== null && parseMonthParam(m) ? `?m=${m}` : "";
  return (
    <nav className="tabs" aria-label="頁面">
      {BOOKMARKS.map(({ href, label }) => (
        <Link key={href} href={`${href}${keep}`} className={href === "/ledger" ? "tab tab-l" : "tab"} aria-current={isCurrent(pathname, href) ? "page" : undefined}>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
