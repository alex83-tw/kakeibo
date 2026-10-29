export const TW_TZ = "Asia/Taipei";
export const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TW_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Taiwan as YYYY-MM-DD. Never derive dates with toISOString() (UTC). */
export function twToday(now: Date = new Date()): string {
  return ymd.format(now);
}

export function currentMonth(now: Date = new Date()): { year: number; month: number } {
  const [y, m] = twToday(now).split("-").map(Number);
  return { year: y, month: m };
}

const pad = (n: number) => String(n).padStart(2, "0");

function daysIn(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function monthRange(
  year: number,
  month: number,
): { start: string; end: string; nextStart: string; days: number } {
  const days = daysIn(year, month);
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(days)}`,
    nextStart: `${ny}-${pad(nm)}-01`,
    days,
  };
}

export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/** 0 = Sunday. Pure date arithmetic, no timezone involved. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const DIGITS = "〇一二三四五六七八九";

/** 1–31 as kanji numerals: 10 → 十, 28 → 二十八. */
export function toKanji(n: number): string {
  if (n < 10) return DIGITS[n];
  if (n === 10) return "十";
  if (n < 20) return `十${DIGITS[n - 10]}`;
  const ones = n % 10;
  return `${DIGITS[Math.floor(n / 10)]}十${ones ? DIGITS[ones] : ""}`;
}

/** Calendar month `delta` months away (negative = earlier). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** `{2026, 10}` → `2026-10`, the `?m=` spelling. */
export function formatMonthParam(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

/** `?m=2026-10` → { year, month }, or null when it is not a month between 2000 and 2100. */
export function parseMonthParam(s: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 ? { year, month } : null;
}

/** `?m=` from a search param (anything, since it comes off the URL): a valid month, else this month. */
export function resolveMonth(m: unknown): { year: number; month: number } {
  return (typeof m === "string" && parseMonthParam(m)) || currentMonth();
}

/** A real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
