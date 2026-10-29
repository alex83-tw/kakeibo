import type { AccountKind } from "./types";

const abs2 = (n: number) => Math.round(Math.abs(n) * 100) / 100;

/**
 * diff = book − statement. Negative means the book shows less (△).
 * For a credit card the book is negative, so a negative diff reads as owing more.
 */
export function reconcile(
  kind: AccountKind,
  book: number,
  statement: number,
): { diff: number; matched: boolean; sentence: string } {
  const diff = Math.round((book - statement) * 100) / 100;
  if (diff === 0) return { diff: 0, matched: true, sentence: "對上" };
  const n = abs2(diff).toLocaleString("en-US");
  const sentence =
    kind === "credit_card"
      ? `帳簿比實際${diff < 0 ? "多" : "少"}欠 ${n}`
      : `帳簿比實際${diff < 0 ? "少" : "多"} ${n}`;
  return { diff, matched: false, sentence };
}

/** What a gap probably means. Direction follows reconcile(): diff = book − statement. */
export function reconcileHint(kind: AccountKind, diff: number): string {
  if (diff === 0) return "";
  if (kind === "credit_card") return diff < 0 ? "可能多記或退款未記" : "可能漏記消費";
  return diff < 0 ? "可能漏記收入" : "可能漏記支出";
}
