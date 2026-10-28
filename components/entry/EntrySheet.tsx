"use client";

import { useState } from "react";
import { softDeleteEntry } from "@/app/actions/entries";
import { ToastSlot, useToast } from "@/components/ui/Toast";
import type { LedgerAccount } from "@/lib/domain/types";
import { EntryDialog } from "./EntryDialog";

/** The pinned 記一筆 button, the new-entry dialog, and the "已記錄 … 復原" toast. */
export function EntrySheet({
  accounts,
  recentCategories,
}: {
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
}) {
  const [open, setOpen] = useState(false);
  const { toast, show, clear } = useToast();

  async function undo(id: string) {
    clear();
    const res = await softDeleteEntry(id);
    show({ text: res.ok ? "已復原" : "復原失敗，請到帳本刪除" });
  }

  return (
    <>
      <div className="dock">
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          記一筆
        </button>
      </div>
      <EntryDialog
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        recentCategories={recentCategories}
        onSaved={(s) => show({ text: s.text, action: { label: "復原", run: () => undo(s.id) } })}
      />
      <ToastSlot toast={toast} />
    </>
  );
}
