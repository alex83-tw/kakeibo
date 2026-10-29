"use client";

import type { ReactNode } from "react";

export interface RecordPreset {
  main: string;
  sub: string;
  notes: string;
}

/** Event the pinned 記一筆 sheet listens for; lets an alert open the entry form with the category and note already filled. */
export const RECORD_EVENT = "kakeibo:record";

/** Event the sheet listens for to open an existing entry for editing or deletion (a ledger line dispatches it). */
export const EDIT_EVENT = "kakeibo:edit";

export function RecordButton({ preset, children }: { preset: RecordPreset; children: ReactNode }) {
  return (
    <button type="button" className="act" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent<RecordPreset>(RECORD_EVENT, { detail: preset }))}>
      {children}
    </button>
  );
}
