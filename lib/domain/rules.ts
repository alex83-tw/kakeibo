import type { CategoryRule } from "./recurring";

/** The rule whose keyword the notes contain (ignoring case); the longest keyword wins, so 「全聯福利中心」beats 「全聯」. */
export function matchRule(rules: CategoryRule[], notes: string, type: CategoryRule["entry_type"]): CategoryRule | null {
  const text = notes.toLowerCase();
  let best: CategoryRule | null = null;
  for (const r of rules) {
    const k = r.keyword.trim().toLowerCase();
    if (r.entry_type !== type || k === "" || !text.includes(k)) continue;
    if (!best || k.length > best.keyword.trim().length) best = r;
  }
  return best;
}
