"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createEntry, updateEntry } from "@/app/actions/entries";
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, normalizeSub, subLabel } from "@/lib/domain/categories";
import type { Entry, EntryType, LedgerAccount } from "@/lib/domain/types";
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

export interface SavedEntry {
  id: string;
  text: string;
}

const joinCategory = (main: string, sub: string) => `${main}::${sub}`;
function splitCategory(v: string): { main: string; sub: string } {
  const [main = "", sub = "other"] = v.split("::");
  return { main, sub };
}

/**
 * The entry form: create, or edit when `initial` is given. It is mounted only while the dialog is open,
 * so its state always starts fresh from `initial` (or blank) with no reset logic.
 */
export function EntryForm({
  accounts,
  recentCategories,
  initial,
  onSaved,
}: {
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
  initial?: Entry;
  onSaved: (saved: SavedEntry) => void;
}) {
  const live = accounts.filter((a) => !a.archived || a.id === initial?.account_id || a.id === initial?.transfer_account_id);
  const recent = recentCategories.slice(0, 5);
  const defaultCategory = (type: EntryType) =>
    type === "expense" && recent[0] ? joinCategory(recent[0].main, recent[0].sub) : "";

  const [type, setType] = useState<EntryType>(initial?.entry_type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(
    initial
      ? initial.entry_type === "transfer"
        ? ""
        : joinCategory(initial.main_category, normalizeSub(initial.sub_category))
      : defaultCategory("expense"),
  );
  const [accountId, setAccountId] = useState(initial ? (initial.account_id ?? "") : (live[0]?.id ?? ""));
  const [toId, setToId] = useState(initial ? (initial.transfer_account_id ?? "") : (live[1]?.id ?? ""));
  const [date, setDate] = useState(() => initial?.entry_date ?? twToday());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [focusTick, setFocusTick] = useState<{ id: string; n: number } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focusTick) document.getElementById(focusTick.id)?.focus();
  }, [focusTick]);

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
    const res = initial ? await updateEntry(initial.id, input) : await createEntry(input);
    setPending(false);
    if (!res.ok) return fail(res.errors);

    const kind = KINDS.find((k) => k.type === type)?.label ?? "";
    onSaved({ id: res.id, text: `${initial ? "已更新" : "已記錄"} NT$${formatAmount(v.value.amount)} ${kind}` });
  }

  const taxonomy = type === "income" ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const err = (k: keyof Errors) => errors[k];
  const known = new Set(Object.entries(taxonomy).flatMap(([main, subs]) => ["other", ...subs].map((s) => joinCategory(main, s))));
  const legacy = category !== "" && !known.has(category) && !recent.some((r) => joinCategory(r.main, r.sub) === category) ? category : null;

  return (
    <>
      <div className="entry-h">
        <Dialog.Title>{initial ? "編輯帳目" : "記一筆"}</Dialog.Title>
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
              {legacy ? (
                <option value={legacy}>
                  {splitCategory(legacy).main}／{subLabel(splitCategory(legacy).sub)}
                </option>
              ) : null}
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
    </>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
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
