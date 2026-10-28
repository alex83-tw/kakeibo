"use client";

import { useState } from "react";
import { restoreEntry, softDeleteEntry } from "@/app/actions/entries";
import { EntryDialog } from "@/components/entry/EntryDialog";
import { ToastSlot, useToast } from "@/components/ui/Toast";
import { subLabel } from "@/lib/domain/categories";
import type { Entry, LedgerAccount } from "@/lib/domain/types";
import { formatAmount } from "@/lib/money";

/** One day's entries, each editable and deletable (delete = soft delete with a 5-second 復原). */
export function DayEntries({
  entries,
  accounts,
  recentCategories,
}: {
  entries: Entry[];
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
}) {
  const [editing, setEditing] = useState<Entry | null>(null);
  const { toast, show, clear } = useToast();
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "未指定";

  async function remove(e: Entry) {
    const res = await softDeleteEntry(e.id);
    if (!res.ok) return show({ text: res.errors.form ?? "刪除失敗" });
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
      <ul className="de-list">
        {entries.map((e) => {
          const counted = e.currency === "TWD";
          const title = e.entry_type === "transfer" ? "轉帳" : `${e.main_category}／${subLabel(e.sub_category ?? "other")}`;
          const where = e.entry_type === "transfer" ? `${name(e.account_id)} → ${name(e.transfer_account_id)}` : name(e.account_id);
          return (
            <li key={e.id} className="de">
              <div className="de-main">
                <b>{title}</b>
                <span className="de-amt">
                  {counted ? `${e.entry_type === "income" ? "＋" : ""}${formatAmount(e.amount)}` : "未納入"}
                </span>
              </div>
              <div className="de-sub">
                {[e.notes, where, counted ? null : `${e.currency} ${formatAmount(e.amount)}`].filter(Boolean).join("　")}
              </div>
              <div className="de-act">
                {counted ? (
                  <button type="button" className="ghost" onClick={() => setEditing(e)}>
                    編輯<span className="sr">：{title}</span>
                  </button>
                ) : null}
                <button type="button" className="ghost" onClick={() => remove(e)}>
                  刪除<span className="sr">：{title}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <EntryDialog
        key={editing?.id ?? "none"}
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        accounts={accounts}
        recentCategories={recentCategories}
        initial={editing ?? undefined}
        onSaved={() => show({ text: "已更新" })}
      />
      <ToastSlot toast={toast} />
    </>
  );
}
