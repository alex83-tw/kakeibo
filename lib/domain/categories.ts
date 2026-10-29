import type { Entry } from "./types";

export type EntryKind = "income" | "expense";

type Taxonomy = Readonly<Record<string, readonly string[]>>;

/** 「一般」是每個主分類隱含的預設子分類（儲存為 `other`），不列在這裡。 */
export const EXPENSE_TAXONOMY: Taxonomy = {
  餐飲: ["早餐", "午餐", "晚餐", "宵夜", "飲料", "咖啡", "聚餐", "零食"],
  交通: ["捷運", "公車", "計程車", "加油", "停車", "高鐵台鐵", "機車保養"],
  居住: ["房租", "水費", "電費", "瓦斯", "網路", "電話費", "管理費", "修繕"],
  日用購物: ["生活用品", "衣物", "3C 數位", "家具家電", "美妝保養"],
  醫療保健: ["掛號", "藥品", "牙科", "健檢", "保健食品"],
  娛樂休閒: ["電影", "旅遊", "運動健身", "遊戲", "訂閱服務", "書籍"],
  學習成長: ["課程", "教材", "證照考試", "研討會"],
  人情社交: ["紅白包", "禮物", "請客"],
  家庭: ["孕嬰育兒", "寵物", "長輩孝親", "家人零用"],
  保險: ["壽險", "醫療險", "意外險", "車險"],
  稅費: ["所得稅", "房屋稅", "地價稅", "牌照稅", "手續費"],
  其他: ["捐款", "罰款", "雜項"],
};

export const INCOME_TAXONOMY: Taxonomy = {
  薪資: ["本薪", "加班費", "津貼"],
  獎金: ["年終獎金", "績效獎金", "三節獎金"],
  兼職副業: ["接案", "家教", "二手出售"],
  投資收益: ["股利", "利息", "資本利得"],
  退稅補助: ["所得稅退稅", "政府補助"],
  其他: ["禮金", "退款", "雜項"],
};

const DEFAULT_SUB = "other";

export function normalizeSub(sub: string | null | undefined): string {
  const s = sub?.trim() ?? "";
  return s === "" || s === "一般" || s === DEFAULT_SUB ? DEFAULT_SUB : s;
}

export function subLabel(sub: string): string {
  return sub === DEFAULT_SUB ? "一般" : sub;
}

/** One key for every spelling of the default sub; budgets and entries must agree on it. */
export function categoryKey(main: string, sub: string | null | undefined): string {
  return `${main}::${normalizeSub(sub)}`;
}

export function isUncategorized(
  main: string | null | undefined,
  sub: string | null | undefined,
): boolean {
  const m = main?.trim() ?? "";
  return m === "" || (m === "其他" && normalizeSub(sub) === DEFAULT_SUB);
}

/**
 * Distinct expense (main, sub) pairs, most recently used first. `entries` is oldest-first (listEntries order), so on one day the later entry wins.
 * Entries dated after `today` (pre-booked rent, a future-dated import) are skipped when given: they say nothing about what was used lately.
 */
export function recentCategories(entries: Entry[], limit = 5, today?: string): { main: string; sub: string }[] {
  const seen = new Set<string>();
  const out: { main: string; sub: string }[] = [];
  const sorted = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.entry_type === "expense" && (today === undefined || e.entry_date <= today))
    .sort((a, b) => b.e.entry_date.localeCompare(a.e.entry_date) || b.i - a.i)
    .map(({ e }) => e);
  for (const e of sorted) {
    const sub = normalizeSub(e.sub_category);
    const key = categoryKey(e.main_category, sub);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ main: e.main_category, sub });
    if (out.length === limit) break;
  }
  return out;
}
