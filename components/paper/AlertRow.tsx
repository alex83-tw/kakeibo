import Link from "next/link";
import type { ReactNode } from "react";
import { RecordButton, type RecordPreset } from "@/components/entry/RecordButton";

/**
 * 注意列，48px 高。「需處理」＝朱色實心籤；其餘＝空心籤，籤上的字說明是哪一種提醒（預設「待確認」）。
 * 意義一律以籤上的字傳達，不靠顏色；動作連結的點擊區 ≥ 44px。
 * 有 preset 時動作是打開已填好科目與摘要的記一筆，而不是換頁。
 */
export function AlertRow({
  tone,
  label,
  href,
  actionLabel,
  preset,
  children,
}: {
  tone: "action" | "question";
  label?: string;
  href: string;
  actionLabel: string;
  preset?: RecordPreset;
  children: ReactNode;
}) {
  return (
    <div className="alert">
      <span className={tone === "action" ? "tag" : "tag q"}>{label ?? (tone === "action" ? "需處理" : "待確認")}</span>
      <span>{children}</span>
      {preset ? (
        <RecordButton preset={preset}>{actionLabel}</RecordButton>
      ) : (
        <Link className="act" href={href}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
