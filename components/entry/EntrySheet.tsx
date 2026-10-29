"use client";

import { useEffect, useState } from "react";
import { restoreEntry, softDeleteEntry } from "@/app/actions/entries";
import { useToast } from "@/components/ui/Toast";
import type { CategoryRule } from "@/lib/domain/recurring";
import type { Entry, LedgerAccount } from "@/lib/domain/types";
import { EntryDialog } from "./EntryDialog";
import { EDIT_EVENT, RECORD_EVENT, type RecordPreset } from "./RecordButton";

/** The pinned 記一筆 button, the entry dialog (new or editing), and the toasts with 復原. */
export function EntrySheet({
  accounts,
  recentCategories,
  rules = [],
}: {
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
  rules?: CategoryRule[];
}) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<RecordPreset | undefined>();
  const [editing, setEditing] = useState<Entry | undefined>();
  const { show, clear } = useToast();

  // An alert can open the form with a category and note filled in (see RecordButton); a ledger line opens its entry.
  useEffect(() => {
    const onRecord = (e: Event) => {
      setEditing(undefined);
      setPreset((e as CustomEvent<RecordPreset>).detail);
      setOpen(true);
    };
    const onEdit = (e: Event) => {
      setPreset(undefined);
      setEditing((e as CustomEvent<Entry>).detail);
      setOpen(true);
    };
    window.addEventListener(RECORD_EVENT, onRecord);
    window.addEventListener(EDIT_EVENT, onEdit);
    return () => {
      window.removeEventListener(RECORD_EVENT, onRecord);
      window.removeEventListener(EDIT_EVENT, onEdit);
    };
  }, []);

  async function undoCreate(id: string) {
    clear();
    const res = await softDeleteEntry(id);
    show({ text: res.ok ? "已復原" : "復原失敗，請在帳本點那筆刪除" });
  }

  async function remove(e: Entry) {
    const res = await softDeleteEntry(e.id);
    if (!res.ok) return show({ text: res.errors.form ?? "刪除失敗" });
    setOpen(false);
    show({
      text: "已刪除一筆帳目",
      action: {
        label: "復原",
        run: async () => {
          clear();
          const back = await restoreEntry(e.id);
          show({ text: back.ok ? "已復原" : "復原失敗" });
        },
      },
    });
  }

  return (
    <>
      <div className="dock">
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => {
            setPreset(undefined);
            setEditing(undefined);
            setOpen(true);
          }}>
          記一筆
        </button>
      </div>
      <EntryDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        recentCategories={recentCategories}
        rules={rules}
        preset={preset}
        initial={editing}
        onDelete={editing ? () => remove(editing) : undefined}
        onSaved={(s) => show(editing ? { text: s.text } : { text: s.text, action: { label: "復原", run: () => undoCreate(s.id) } })}
      />
    </>
  );
}
