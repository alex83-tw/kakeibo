"use client";

import type { ReactNode } from "react";
import { EDIT_EVENT } from "@/components/entry/RecordButton";
import type { Entry } from "@/lib/domain/types";

/** Covers its whole ledger line (via CSS) and opens that entry in the entry sheet. */
export function LineButton({ entry, children }: { entry: Entry; children: ReactNode }) {
  return (
    <button type="button" className="ln" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent<Entry>(EDIT_EVENT, { detail: entry }))}>
      {children}
    </button>
  );
}
