import { isUncategorized, normalizeSub } from "./categories";
import type { CategoryRule } from "./recurring";
import { matchRule } from "./rules";
import type { Entry } from "./types";
import { stripControl } from "./csv-safe";
import { isRealDate } from "@/lib/time";

/**
 * 信用卡網銀明細貼上：每行 `消費時間 ⇥ 摘要 ⇥ 卡號末四碼 ⇥ 新台幣金額 ⇥ 消費地 ⇥ 更多`，第一行是表頭（可有可無）。
 * 金額欄已是新台幣（外幣消費銀行換算過了，消費地只是資訊），所以匯入一律是 TWD。負數是退款。
 */
export interface ParsedRow {
  /** 1-based line in the pasted text */
  line: number;
  date: string;
  /** HH:MM, "" when the line has none */
  time: string;
  merchant: string;
  /** signed TWD: negative is a refund */
  amount: number;
}

const DATE_TIME = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/;
/** The bank's placeholder for a charge it has no merchant for. */
const NO_INFO = "暫無資訊";
const MAX_NOTES = 200;

const pad = (s: string) => s.padStart(2, "0");

export function parseBatchText(text: string): { rows: ParsedRow[]; errors: { line: number; message: string }[] } {
  const rows: ParsedRow[] = [];
  const errors: { line: number; message: string }[] = [];
  text.replace(/^﻿/, "").split(/\r\n|\r|\n/).forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === "") return;
    const cells = (raw.includes("\t") ? raw.split("\t") : raw.trim().split(/\s{2,}/)).map((c) => c.trim());
    if (cells[0].startsWith("消費時間")) return; // header
    const fail = (message: string) => void errors.push({ line, message });

    const m = DATE_TIME.exec(cells[0]);
    if (!m) return fail("第一欄要是日期，例如 2026/10/31 18:33");
    const date = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if (!isRealDate(date)) return fail(`日期不存在：${cells[0]}`);

    // 摘要 may be missing on a short line; the amount is always the 4th cell of the bank's layout
    if (cells.length < 4) return fail("欄位不足（要有 日期、摘要、卡號末四碼、金額）");
    const amount = Number(cells[3].replace(/,/g, ""));
    if (cells[3] === "" || !Number.isFinite(amount)) return fail(`金額看不懂：${cells[3]}`);
    if (amount === 0) return fail("金額是 0");
    if (Math.abs(amount) > 999_999_999 || Math.round(amount * 100) !== amount * 100) return fail(`金額不正確：${cells[3]}`);

    const merchant = stripControl(cells[1] === NO_INFO ? "" : cells[1]).replace(/\s+/g, " ").trim().slice(0, MAX_NOTES);
    rows.push({ line, date, time: m[4] ? `${pad(m[4])}:${m[5]}` : "", merchant, amount });
  });
  return { rows, errors };
}

export interface BatchCategory {
  entry_type: "expense" | "income";
  main: string;
  sub: string;
}

/** A refund (negative amount) is booked as income 其他／退款: kakeibo has no negative amounts. */
export const REFUND: BatchCategory = { entry_type: "income", main: "其他", sub: "退款" };
const UNKNOWN: BatchCategory = { entry_type: "expense", main: "其他", sub: "other" };

/**
 * A charge's category: a 自動分類 rule if one matches, else the category of the newest past expense whose note contains this
 * merchant or is contained in it (a note of 1 character matches everything, so those do not count), else 其他／一般.
 * `history` is oldest-first, like listRecentEntries.
 */
export function categorize(row: Pick<ParsedRow, "merchant" | "amount">, rules: CategoryRule[], history: Entry[]): BatchCategory {
  if (row.amount < 0) return REFUND;
  const hit = matchRule(rules, row.merchant, "expense");
  if (hit) return { entry_type: "expense", main: hit.main_category, sub: normalizeSub(hit.sub_category) };
  const text = row.merchant.toLowerCase();
  if (text.length < 2) return UNKNOWN;
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    const note = e.notes?.trim().toLowerCase() ?? "";
    if (e.entry_type !== "expense" || note.length < 2 || isUncategorized(e.main_category, e.sub_category)) continue;
    if (note.includes(text) || text.includes(note)) return { entry_type: "expense", main: e.main_category, sub: normalizeSub(e.sub_category) };
  }
  return UNKNOWN;
}

/** The amount and currency as stored: a converted foreign entry comes back from listEntries in TWD with the original in `foreign`. */
const stored = (e: Entry) => ({ amount: e.foreign?.amount ?? e.amount, currency: e.foreign?.currency ?? e.currency });

/**
 * Which rows are already in the ledger: same date, same type and same amount (TWD). Each live entry cancels at most one row,
 * so two identical coffees against one existing coffee leave one to add. Returns one flag per row, in order.
 */
export function markDuplicates(rows: { date: string; entry_type: "expense" | "income"; amount: number }[], existing: Entry[]): boolean[] {
  const have = new Map<string, number>();
  for (const e of existing) {
    const s = stored(e);
    if (e.deleted_at !== null || s.currency !== "TWD") continue;
    const key = `${e.entry_date}|${e.entry_type}|${s.amount}`;
    have.set(key, (have.get(key) ?? 0) + 1);
  }
  return rows.map((r) => {
    const key = `${r.date}|${r.entry_type}|${r.amount}`;
    const n = have.get(key) ?? 0;
    if (n > 0) have.set(key, n - 1);
    return n > 0;
  });
}
