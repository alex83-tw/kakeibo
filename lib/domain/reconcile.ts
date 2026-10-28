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
      ? `帳面比帳單${diff < 0 ? "多" : "少"}欠 ${n}`
      : `帳面比帳單${diff < 0 ? "少" : "多"} ${n}`;
  return { diff, matched: false, sentence };
}
