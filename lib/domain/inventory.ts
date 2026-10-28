import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, normalizeSub, type EntryKind } from "./categories";
import type { Entry } from "./types";

export interface MainInventory {
  main: string;
  count: number;
  subs: { sub: string; count: number }[];
}

/** Every main/sub the user can pick: the built-in taxonomy plus anything they typed, with live entry counts. */
export function categoryInventory(kind: EntryKind, entries: Entry[]): MainInventory[] {
  const taxonomy = kind === "income" ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const out = new Map<string, Map<string, number>>();
  for (const [main, subs] of Object.entries(taxonomy)) {
    out.set(main, new Map([["other", 0], ...subs.map((s) => [s, 0] as [string, number])]));
  }
  for (const e of entries) {
    if (e.deleted_at !== null || e.entry_type !== kind) continue;
    const subs = out.get(e.main_category) ?? new Map<string, number>([["other", 0]]);
    out.set(e.main_category, subs);
    const sub = normalizeSub(e.sub_category);
    subs.set(sub, (subs.get(sub) ?? 0) + 1);
  }
  return [...out].map(([main, subs]) => ({
    main,
    count: [...subs.values()].reduce((s, n) => s + n, 0),
    subs: [...subs].map(([sub, count]) => ({ sub, count })),
  }));
}
