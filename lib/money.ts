export const MAX_AMOUNT = 999_999_999;

/**
 * Parses user-typed money: thousands commas and spaces are ignored, `△` or `-`
 * mean negative, at most two decimals. Returns null for anything else.
 */
export function parseAmountInput(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, "").replace(/^△/, "-");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Math.abs(n) > MAX_AMOUNT ? null : n;
}

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Absolute value with thousands separators. */
export function formatAmount(n: number): string {
  return nf.format(Math.abs(n));
}

/** Negative numbers get a △ prefix instead of a minus sign. */
export function formatSigned(n: number): string {
  return n < 0 ? `△${formatAmount(n)}` : formatAmount(n);
}

export function roundToTen(n: number): number {
  return Math.round(n / 10) * 10;
}
