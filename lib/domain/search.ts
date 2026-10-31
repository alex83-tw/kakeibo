import { subLabel } from "./categories";
import type { Entry, EntryType } from "./types";
import { parseAmountInput } from "@/lib/money";
import { isRealDate } from "@/lib/time";

export const PAGE_SIZE = 50;
/** The most rows a search reads: filters on amount, text and sort run in memory (see applyMemoryFilters), so the read is bounded. */
export const SEARCH_CAP = 3000;

export const SORTS = ["date-desc", "date-asc", "amount-desc", "amount-asc"] as const;
export type SearchSort = (typeof SORTS)[number];
const TYPES: readonly EntryType[] = ["expense", "income", "transfer"];

export interface SearchFilters {
  /** text matched against category, notes and account name */
  q: string;
  type: EntryType | "";
  main: string;
  /** YYYY-MM-DD, inclusive; "" = open */
  from: string;
  to: string;
  /** TWD, inclusive; null = open */
  min: number | null;
  max: number | null;
  sort: SearchSort;
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/** The URL is the state, so anything in it is untrusted: every field falls back to "no filter" when it is not valid. */
export function parseSearchParams(raw: Raw): SearchFilters {
  const date = (k: string) => {
    const v = one(raw[k]).trim();
    return isRealDate(v) ? v : "";
  };
  const amount = (k: string) => {
    const v = one(raw[k]).trim();
    const n = v === "" ? null : parseAmountInput(v);
    return n === null || n < 0 ? null : n;
  };
  let from = date("from");
  let to = date("to");
  if (from && to && from > to) [from, to] = [to, from];
  let min = amount("min");
  let max = amount("max");
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const type = one(raw.type);
  const sort = one(raw.sort);
  const page = Number.parseInt(one(raw.page), 10);
  return {
    q: one(raw.q).trim().slice(0, 100),
    type: (TYPES as readonly string[]).includes(type) ? (type as EntryType) : "",
    main: one(raw.main).trim().slice(0, 40),
    from,
    to,
    min,
    max,
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as SearchSort) : "date-desc",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}

/** Only what differs from "no filter", so a shared link stays short. `page` overrides the filters' own. */
export function toQueryString(f: SearchFilters, page: number = f.page): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.type) p.set("type", f.type);
  if (f.main) p.set("main", f.main);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.min !== null) p.set("min", String(f.min));
  if (f.max !== null) p.set("max", String(f.max));
  if (f.sort !== "date-desc") p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s === "" ? "" : `?${s}`;
}

/** What the database can filter on; amount is left out because a foreign row's TWD amount only exists after conversion. */
export function sqlFilter(f: SearchFilters): { type: EntryType | ""; main: string; from: string; to: string } {
  return { type: f.type, main: f.main, from: f.from, to: f.to };
}

/** The filters the database does not do: text (category, notes, account name) and the TWD amount range. A foreign row with no rate keeps its own amount. */
export function applyMemoryFilters(entries: Entry[], f: SearchFilters, accountNames: Record<string, string>): Entry[] {
  const needle = f.q.toLowerCase();
  return entries.filter((e) => {
    if (f.min !== null && e.amount < f.min) return false;
    if (f.max !== null && e.amount > f.max) return false;
    if (needle === "") return true;
    const name = (id: string | null) => (id ? (accountNames[id] ?? "") : "");
    const hay = [e.main_category, subLabel(e.sub_category ?? "other"), e.notes ?? "", name(e.account_id), name(e.transfer_account_id)].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

/** `entries` arrive newest first (the repo's order); ties keep that order, so the same-day entry added last stays on top. */
export function sortEntries(entries: Entry[], sort: SearchSort): Entry[] {
  if (sort === "date-desc") return entries;
  if (sort === "date-asc") return [...entries].reverse();
  const dir = sort === "amount-desc" ? -1 : 1;
  return [...entries].sort((a, b) => (a.amount - b.amount) * dir);
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const at = Math.min(Math.max(1, page), pages);
  return { items: items.slice((at - 1) * size, at * size), page: at, pages, total: items.length };
}

/** What the matches add up to; transfers move money and an unconverted foreign row has no TWD value, so neither counts. */
export function sumMatches(entries: Entry[]): { expense: number; income: number } {
  let expense = 0;
  let income = 0;
  for (const e of entries) {
    if (e.currency !== "TWD") continue;
    if (e.entry_type === "expense") expense += e.amount;
    else if (e.entry_type === "income") income += e.amount;
  }
  return { expense, income };
}

const TYPE_LABEL = { expense: "支出", income: "收入", transfer: "轉帳" } as const;

/** The active criteria in a few words, for the collapsed form's heading. "" when nothing is filtered. */
export function describeFilters(f: SearchFilters): string {
  const parts: string[] = [];
  if (f.q) parts.push(`「${f.q}」`);
  if (f.type) parts.push(TYPE_LABEL[f.type]);
  if (f.main) parts.push(f.main);
  if (f.from || f.to) parts.push(f.from && f.to ? `${f.from}～${f.to}` : f.from ? `${f.from} 起` : `至 ${f.to}`);
  if (f.min !== null || f.max !== null) parts.push(f.min !== null && f.max !== null ? `${f.min}～${f.max} 元` : f.min !== null ? `${f.min} 元以上` : `${f.max} 元以下`);
  return parts.join("　");
}
