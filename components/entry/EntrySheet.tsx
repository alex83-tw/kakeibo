"use client";

import { useEffect, useState } from "react";
import { softDeleteEntry } from "@/app/actions/entries";
import { ToastSlot, useToast } from "@/components/ui/Toast";
import type { LedgerAccount } from "@/lib/domain/types";
import { EntryDialog } from "./EntryDialog";
import { RECORD_EVENT, type RecordPreset } from "./RecordButton";

/** The pinned 記一筆 button, the new-entry dialog, and the "已記錄 … 復原" toast. */
export function EntrySheet({
  accounts,
  recentCategories,
}: {
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<RecordPreset | undefined>();
  const { toast, show, clear } = useToast();

  // An alert can open the form with a category and note filled in (see RecordButton).
  useEffect(() => {
    const onRecord = (e: Event) => {
      setPreset((e as CustomEvent<RecordPreset>).detail);
      setOpen(true);
    };
    window.addEventListener(RECORD_EVENT, onRecord);
    return () => window.removeEventListener(RECORD_EVENT, onRecord);
  }, []);

  async function undo(id: string) {
    clear();
    const res = await softDeleteEntry(id);
    show({ text: res.ok ? "已復原" : "復原失敗，請到帳本刪除" });
  }

  return (
    <>
      <div className="dock">
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => {
            setPreset(undefined);
            setOpen(true);
          }}>
          記一筆
        </button>
      </div>
      <EntryDialog
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        recentCategories={recentCategories}
        preset={preset}
        onSaved={(s) => show({ text: s.text, action: { label: "復原", run: () => undo(s.id) } })}
      />
      <ToastSlot toast={toast} />
    </>
  );
}
