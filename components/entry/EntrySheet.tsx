"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createEntry, softDeleteEntry } from "@/app/actions/entries";
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, subLabel } from "@/lib/domain/categories";
import type { EntryType, LedgerAccount } from "@/lib/domain/types";
import { validateEntryInput, type EntryInput } from "@/lib/domain/validate";
import { formatAmount } from "@/lib/money";
import { twToday } from "@/lib/time";
import { AmountField } from "./AmountField";

const KINDS: { type: EntryType; label: string }[] = [
  { type: "expense", label: "支出" },
  { type: "income", label: "收入" },
  { type: "transfer", label: "轉帳" },
];
const KIND_NOTE: Record<EntryType, string> = {
  expense: "",
  income: "收入的科目決定它算哪一類收入",
  transfer: "轉帳只移動餘額，不計入收入與支出",
};
const TOAST_MS = 5000;

const FIELD_ID: Record<keyof EntryInput | "form", string> = {
  amount: "entry-amount",
  main_category: "entry-category",
  account_id: "entry-account",
  transfer_account_id: "entry-to",
  entry_date: "entry-date",
  notes: "entry-notes",
  entry_type: "entry-type",
  sub_category: "entry-category",
  form: "entry-save",
};
const FIELD_ORDER: (keyof EntryInput)[] = ["amount", "main_category", "account_id", "transfer_account_id", "entry_date", "notes"];

type Errors = Partial<Record<keyof EntryInput | "form", string>>;
interface Toast {
  text: string;
  undoId: string | null;
}

const joinCategory = (main: string, sub: string) => `${main}::${sub}`;
function splitCategory(v: string): { main: string; sub: string } {
  const [main = "", sub = "other"] = v.split("::");
  return { main, sub };
}

export function EntrySheet({
  accounts,
  recentCategories,
}: {
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
}) {
  const live = accounts.filter((a) => !a.archived);
  const recent = recentCategories.slice(0, 5);
  const defaultCategory = (type: EntryType) =>
    type === "expense" && recent[0] ? joinCategory(recent[0].main, recent[0].sub) : "";

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EntryType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(defaultCategory("expense"));
  const [accountId, setAccountId] = useState(live[0]?.id ?? "");
  const [toId, setToId] = useState(live[1]?.id ?? "");
  const [date, setDate] = useState(() => twToday());
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [focusTick, setFocusTick] = useState<{ id: string; n: number } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focusTick) document.getElementById(focusTick.id)?.focus();
  }, [focusTick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  function reset() {
    setType("expense");
    setAmount("");
    setCategory(defaultCategory("expense"));
    setAccountId(live[0]?.id ?? "");
    setToId(live[1]?.id ?? "");
    setDate(twToday());
    setNotes("");
    setErrors({});
  }

  function pickType(next: EntryType) {
    setType(next);
    setCategory(defaultCategory(next));
    setErrors({});
  }

  function onRadioKey(e: KeyboardEvent, i: number) {
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    const n = (j + KINDS.length) % KINDS.length;
    pickType(KINDS[n].type);
    radios.current[n]?.focus();
  }

  function fail(errs: Errors) {
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]) ?? "form";
    setFocusTick((t) => ({ id: FIELD_ID[first], n: (t?.n ?? 0) + 1 }));
  }

  async function save() {
    const input: EntryInput = {
      entry_type: type,
      amount,
      main_category: type === "transfer" ? "" : splitCategory(category).main,
      sub_category: type === "transfer" ? "" : splitCategory(category).sub,
      account_id: accountId,
      transfer_account_id: type === "transfer" ? toId : "",
      entry_date: date,
      notes,
    };
    const v = validateEntryInput(input);
    if (!v.ok) return fail(v.errors);

    setPending(true);
    const res = await createEntry(input);
    setPending(false);
    if (!res.ok) return fail(res.errors);

    setOpen(false);
    const kind = KINDS.find((k) => k.type === type)?.label ?? "";
    setToast({ text: `已記錄 NT$${formatAmount(v.value.amount)} ${kind}`, undoId: res.id });
  }

  async function undo(id: string) {
    setToast(null);
    const res = await softDeleteEntry(id);
    setToast({ text: res.ok ? "已復原" : "復原失敗，請到帳本刪除", undoId: null });
  }

  const taxonomy = type === "income" ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const err = (k: keyof Errors) => errors[k];

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) reset();
          setOpen(next);
        }}
      >
        <div className="dock">
          <Dialog.Trigger asChild>
            <button type="button" className="btn">
              記一筆
            </button>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="scrim" />
          <Dialog.Content
            className="entry"
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              amountRef.current?.focus();
            }}
          >
            <div className="entry-h">
              <Dialog.Title>記一筆</Dialog.Title>
              <Dialog.Close className="ghost">取消</Dialog.Close>
            </div>

            <div className="seg" role="radiogroup" aria-label="類型">
              {KINDS.map((k, i) => (
                <button
                  key={k.type}
                  ref={(el) => {
                    radios.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={type === k.type}
                  tabIndex={type === k.type ? 0 : -1}
                  onClick={() => pickType(k.type)}
                  onKeyDown={(e) => onRadioKey(e, i)}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <AmountField id="entry-amount" value={amount} onChange={setAmount} error={err("amount")} inputRef={amountRef} />

            {type === "transfer" ? (
              <>
                <Field id="entry-account" label="轉出" error={err("account_id")}>
                  <select id="entry-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-describedby="entry-account-err">
                    {live.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="entry-to" label="轉入" error={err("transfer_account_id")}>
                  <select id="entry-to" value={toId} onChange={(e) => setToId(e.target.value)} aria-describedby="entry-to-err">
                    <option value="">請選擇</option>
                    {live.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field id="entry-category" label="科目" error={err("main_category")}>
                  <select id="entry-category" value={category} onChange={(e) => setCategory(e.target.value)} aria-describedby="entry-category-err">
                    <option value="">請選擇</option>
                    {type === "expense" && recent.length > 0 ? (
                      <optgroup label="常用">
                        {recent.map((r) => (
                          <option key={`r-${r.main}-${r.sub}`} value={joinCategory(r.main, r.sub)}>
                            {r.main}／{subLabel(r.sub)}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {Object.entries(taxonomy).map(([main, subs]) => (
                      <optgroup key={main} label={main}>
                        {["other", ...subs].map((s) => (
                          <option key={s} value={joinCategory(main, s)}>
                            {main}／{subLabel(s)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field id="entry-account" label="帳戶" error={err("account_id")}>
                  <select id="entry-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-describedby="entry-account-err">
                    <option value="">未指定</option>
                    {live.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <Field id="entry-date" label="日期" error={err("entry_date")}>
              <input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="entry-date-err" />
            </Field>
            <Field id="entry-notes" label="摘要" error={err("notes")}>
              <input id="entry-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="選填" autoComplete="off" aria-describedby="entry-notes-err" />
            </Field>

            <p className="entry-n">{KIND_NOTE[type]}</p>
            <p className="fld-err form-err" aria-live="polite">
              {err("form")}
            </p>
            <button id="entry-save" type="button" className="btn" disabled={pending} onClick={save}>
              儲存
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="toast-slot" role="status">
        {toast ? (
          <div className="toast">
            <span>{toast.text}</span>
            {toast.undoId ? (
              <button type="button" className="ghost" onClick={() => undo(toast.undoId!)}>
                復原
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="fld-wrap">
      <div className="fld">
        <label htmlFor={id}>{label}</label>
        {children}
      </div>
      <p id={`${id}-err`} className="fld-err" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
