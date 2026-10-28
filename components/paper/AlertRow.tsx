import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 注意列，48px 高。朱色方塊＝需要處理；空心方塊＝待確認。
 * 連結點擊區 ≥ 44px；意義一律以文字傳達，不靠顏色。
 */
export function AlertRow({
  tone,
  href,
  actionLabel,
  children,
}: {
  tone: "action" | "question";
  href: string;
  actionLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="alert">
      <span className={tone === "action" ? "mk" : "mk q"} aria-hidden="true" />
      <span>{children}</span>
      <Link className="act" href={href}>
        {actionLabel}
      </Link>
    </div>
  );
}
