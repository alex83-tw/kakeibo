"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import type { Entry, LedgerAccount } from "@/lib/domain/types";
import { EntryForm, type SavedEntry } from "./EntryForm";

/** Radix shell around EntryForm: focus trap, aria-modal, Esc, and focus return to whatever opened it. */
export function EntryDialog({
  open,
  onOpenChange,
  accounts,
  recentCategories,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
  initial?: Entry;
  onSaved: (saved: SavedEntry) => void;
}) {
  // There is no Dialog.Trigger (the opener lives elsewhere), so remember who had focus and hand it back.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className="entry"
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
            initial={initial}
            onSaved={(saved) => {
              onOpenChange(false);
              onSaved(saved);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
