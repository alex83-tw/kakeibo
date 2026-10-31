"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { restoreEntries, softDeleteEntries } from "@/app/actions/entries";
import { useToast } from "@/components/ui/Toast";
import type { Entry } from "@/lib/domain/types";
import { formatAmount } from "@/lib/money";

interface Select {
  selecting: boolean;
  selected: ReadonlyMap<string, Entry>;
  start: () => void;
  cancel: () => void;
  toggle: (e: Entry) => void;
  /** Every line currently shown (the text filter hides rows, it does not remove them). */
  selectShown: () => void;
  remove: () => Promise<void>;
  busy: boolean;
  /** Lines tell the provider which entry they hold, so 全選 can pick rows by what is on screen. */
  register: (e: Entry) => () => void;
}

const SelectContext = createContext<Select | null>(null);

/** Null outside a provider (the 今日 page lists lines too, and never selects). */
export function useSelect(): Select | null {
  return useContext(SelectContext);
}

/**
 * 選取模式: while on, a click on a ledger line marks it instead of opening it. Wrap the page with `key={month}` (or the search)
 * so a selection never outlives the rows it was made on.
 */
export function SelectProvider({ children }: { children: ReactNode }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlyMap<string, Entry>>(new Map());
  const [busy, setBusy] = useState(false);
  const known = useRef(new Map<string, Entry>());
  const { show, clear } = useToast();

  const register = useCallback((e: Entry) => {
    known.current.set(e.id, e);
    return () => void known.current.delete(e.id);
  }, []);
  const cancel = useCallback(() => {
    setSelecting(false);
    setSelected(new Map());
  }, []);
  const start = useCallback(() => setSelecting(true), []);
  const toggle = useCallback((e: Entry) => {
    setSelected((cur) => {
      const next = new Map(cur);
      if (!next.delete(e.id)) next.set(e.id, e);
      return next;
    });
  }, []);
  const selectShown = useCallback(() => {
    const next = new Map<string, Entry>();
    document.querySelectorAll<HTMLElement>("button.ln[data-eid]").forEach((el) => {
      const entry = known.current.get(el.dataset.eid ?? "");
      if (entry && !el.closest("[hidden]")) next.set(entry.id, entry);
    });
    setSelected(next);
  }, []);

  const remove = useCallback(async () => {
    setBusy(true);
    const res = await softDeleteEntries([...selected.keys()]);
    setBusy(false);
    if (!res.ok) return show({ text: res.error });
    cancel();
    if (res.ids.length === 0) return show({ text: "這些帳目已經刪除了" });
    show({
      text: `已刪除 ${res.ids.length} 筆`,
      ms: 10000,
      action: {
        label: "復原",
        run: async () => {
          clear();
          const back = await restoreEntries(res.ids);
          show({ text: back.ok ? `已復原 ${back.ids.length} 筆` : "復原失敗，請重新整理後再試" });
        },
      },
    });
  }, [selected, show, clear, cancel]);

  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, cancel]);

  const value = useMemo(
    () => ({ selecting, selected, start, cancel, toggle, selectShown, remove, busy, register }),
    [selecting, selected, start, cancel, toggle, selectShown, remove, busy, register],
  );
  return <SelectContext.Provider value={value}>{children}</SelectContext.Provider>;
}

/** What the selected lines add up to: transfers move money, and a foreign line without a rate is not counted anywhere else either. */
function totals(entries: Iterable<Entry>) {
  let expense = 0;
  let income = 0;
  for (const e of entries) {
    if (e.currency !== "TWD") continue;
    if (e.entry_type === "expense") expense += e.amount;
    else if (e.entry_type === "income") income += e.amount;
  }
  return { expense, income };
}

/** One row under the filter, only while selecting. */
export function SelectBar() {
  const s = useSelect();
  if (!s?.selecting) return null;
  const { expense, income } = totals(s.selected.values());
  return (
    <div className="lg-sel" role="group" aria-label="批次操作">
      <span className="lg-n" role="status">
        已選 {s.selected.size} 筆{expense > 0 ? `　支出 ${formatAmount(expense)}` : ""}
        {income > 0 ? `　收入 ${formatAmount(income)}` : ""}
      </span>
      <button type="button" className="act" onClick={s.selectShown}>
        全選
      </button>
      <button type="button" className="act" disabled={s.selected.size === 0 || s.busy} onClick={s.remove}>
        刪除
      </button>
      <button type="button" className="act" onClick={s.cancel}>
        取消
      </button>
    </div>
  );
}
