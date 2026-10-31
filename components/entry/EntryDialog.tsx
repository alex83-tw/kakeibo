"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef } from "react";
import type { CategoryRule } from "@/lib/domain/recurring";
import type { Entry, LedgerAccount } from "@/lib/domain/types";
import { EntryForm, type SavedEntry } from "./EntryForm";
import type { RecordPreset } from "./RecordButton";

/** What sits behind the dialog: the whole book (bookmarks, both pages, dock). */
const BACKGROUND = ".book";

/** Radix shell around EntryForm: focus trap, aria-modal, inert background, Esc, and focus return to whatever opened it. */
export function EntryDialog({
  open,
  onOpenChange,
  accounts,
  recentCategories,
  rules,
  initial,
  preset,
  onSaved,
  onDelete,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
  rules: CategoryRule[];
  initial?: Entry;
  preset?: RecordPreset;
  onSaved: (saved: SavedEntry) => void;
  /** given when editing an existing entry */
  onDelete?: () => void;
  /** given when editing: start a new entry from this one */
  onCopy?: () => void;
}) {
  // There is no Dialog.Trigger (the opener lives elsewhere), so remember who had focus and hand it back.
  const opener = useRef<HTMLElement | null>(null);

  // Radix only aria-hides the background; inert also takes it out of the Tab order and out of pointer reach.
  useEffect(() => {
    if (!open) return;
    const behind = [...document.querySelectorAll(BACKGROUND)].filter((el) => !el.hasAttribute("inert"));
    behind.forEach((el) => el.setAttribute("inert", ""));
    return () => behind.forEach((el) => el.removeAttribute("inert"));
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className="entry"
          aria-modal="true"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            opener.current = document.activeElement as HTMLElement | null;
            document.getElementById("entry-amount")?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          <EntryForm
            accounts={accounts}
            recentCategories={recentCategories}
            rules={rules}
            initial={initial}
            preset={preset}
            onSaved={(saved) => {
              onOpenChange(false);
              onSaved(saved);
            }}
          />
          {onCopy ? (
            <button type="button" className="ghost entry-del" onClick={onCopy}>
              複製成新的一筆
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" className="ghost entry-del" onClick={onDelete}>
              刪除這筆
            </button>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
