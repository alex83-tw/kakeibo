"use client";

import type { ReactNode } from "react";
import type { EntryType } from "@/lib/domain/types";

export interface RecordPreset {
  main: string;
  sub: string;
  notes: string;
  /** Set when copying an entry (複製): the rest of what the form starts from. The date is always today. */
  copy?: { type: EntryType; amount: string; currency: string; account_id: string; transfer_account_id: string };
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
