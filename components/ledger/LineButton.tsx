"use client";

import { useEffect, type ReactNode } from "react";
import { EDIT_EVENT } from "@/components/entry/RecordButton";
import type { Entry } from "@/lib/domain/types";
import { useSelect } from "./SelectMode";

/** Covers its whole ledger line (via CSS) and opens that entry in the entry sheet; in 選取模式 it marks the line instead. */
export function LineButton({ entry, children }: { entry: Entry; children: ReactNode }) {
  const select = useSelect();
  const register = select?.register;
  useEffect(() => register?.(entry), [register, entry]);
  const selecting = select?.selecting ?? false;
  return (
    <button
      type="button"
      className="ln"
      aria-haspopup={selecting ? undefined : "dialog"}
      aria-pressed={selecting ? select!.selected.has(entry.id) : undefined}
      data-eid={select ? entry.id : undefined}
      onClick={() => (selecting ? select!.toggle(entry) : window.dispatchEvent(new CustomEvent<Entry>(EDIT_EVENT, { detail: entry })))}
    >
      {children}
    </button>
  );
}
