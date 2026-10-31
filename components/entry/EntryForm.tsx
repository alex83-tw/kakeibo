"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createEntry, previewRate, updateEntry } from "@/app/actions/entries";
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, normalizeSub, subLabel } from "@/lib/domain/categories";
import type { CategoryRule } from "@/lib/domain/recurring";
import { matchRule } from "@/lib/domain/rules";
import type { Entry, EntryType, LedgerAccount } from "@/lib/domain/types";
import { validateEntryInput, type EntryInput } from "@/lib/domain/validate";
import { formatAmount, parseAmountInput } from "@/lib/money";
import { twToday } from "@/lib/time";
import { AmountField } from "./AmountField";
import { useCategoryOptions } from "./CategoryOptions";
import type { RecordPreset } from "./RecordButton";

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
  currency: "entry-amount-cur",
  main_category: "entry-category",
  account_id: "entry-account",
  transfer_account_id: "entry-to",
  entry_date: "entry-date",
  notes: "entry-notes",
  entry_type: "entry-type",
  sub_category: "entry-category",
  form: "entry-save",
};
const FIELD_ORDER: (keyof EntryInput)[] = ["amount", "currency", "main_category", "account_id", "transfer_account_id", "entry_date", "notes"];

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
  rules,
  initial,
  preset,
  onSaved,
}: {
  accounts: LedgerAccount[];
  recentCategories: { main: string; sub: string }[];
  /** 自動分類: while the category is untouched, a keyword typed in the notes picks it. */
  rules: CategoryRule[];
  initial?: Entry;
  /** Prefill for a new entry (an alert's 記帳); ignored when editing. */
  preset?: RecordPreset;
  onSaved: (saved: SavedEntry) => void;
}) {
  const live = accounts.filter((a) => !a.archived || a.id === initial?.account_id || a.id === initial?.transfer_account_id);
  const recent = recentCategories.slice(0, 5);
  const defaultCategory = (type: EntryType) =>
    type === "expense" && recent[0] ? joinCategory(recent[0].main, recent[0].sub) : "";
  const copy = initial ? undefined : preset?.copy;
  const presetCategory = preset && !initial && preset.main !== "" ? joinCategory(preset.main, normalizeSub(preset.sub)) : null;
  // A copied account may have been archived since: only offer what the form can still choose.
  const liveId = (id: string | undefined) => (id !== undefined && live.some((a) => a.id === id) ? id : undefined);

  const [type, setType] = useState<EntryType>(initial?.entry_type ?? copy?.type ?? "expense");
  // A foreign entry arrives converted to TWD; the form edits what is stored.
  const [currency, setCurrency] = useState(initial?.foreign?.currency ?? initial?.currency ?? copy?.currency ?? "TWD");
  const [amount, setAmount] = useState(initial ? String((initial.foreign ?? initial).amount) : (copy?.amount ?? ""));
  const [category, setCategory] = useState(
    initial
      ? initial.entry_type === "transfer"
        ? ""
        : joinCategory(initial.main_category, normalizeSub(initial.sub_category))
      : (presetCategory ?? defaultCategory(copy?.type ?? "expense")),
  );
  const [accountId, setAccountId] = useState(
    initial ? (initial.account_id ?? "") : copy && copy.account_id === "" ? "" : (liveId(copy?.account_id) ?? live[0]?.id ?? ""),
  );
  const [toId, setToId] = useState(initial ? (initial.transfer_account_id ?? "") : (liveId(copy?.transfer_account_id) ?? live[1]?.id ?? ""));
  const [date, setDate] = useState(() => initial?.entry_date ?? twToday());
  // Once the user picks a category (or the form starts from an entry or an alert's preset) no rule overrides it.
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial || presetCategory));
  const [notes, setNotes] = useState(initial?.notes ?? (initial ? "" : (preset?.notes ?? "")));
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [rate, setRate] = useState<{ key: string; value: number | null } | null>(null);
  const [focusTick, setFocusTick] = useState<{ id: string; n: number } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focusTick) document.getElementById(focusTick.id)?.focus();
  }, [focusTick]);

  // The ≈ NT$ preview: the rate on the entry date, looked up when the currency or date changes.
  const rateKey = `${currency}|${date}`;
  useEffect(() => {
    if (currency === "TWD") return;
    let stale = false;
    previewRate(currency, date).then((value) => {
      if (!stale) setRate({ key: rateKey, value });
    });
    return () => {
      stale = true;
    };
  }, [currency, date, rateKey]);

  function pickType(next: EntryType) {
    setType(next);
    if (next === "transfer") setCurrency("TWD");
    setCategory(defaultCategory(next));
    setCategoryTouched(false);
    setErrors({});
  }

  function changeNotes(value: string) {
    setNotes(value);
    if (categoryTouched || type === "transfer") return;
    const hit = matchRule(rules, value, type);
    if (hit) setCategory(joinCategory(hit.main_category, hit.sub_category));
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
      currency,
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
    onSaved({ id: res.id, text: `${initial ? "已更新" : "已記錄"} ${currency === "TWD" ? "NT$" : `${currency} `}${formatAmount(v.value.amount)} ${kind}` });
  }

  const options = useCategoryOptions();
  const taxonomy = type === "income" ? (options?.income ?? INCOME_TAXONOMY) : (options?.expense ?? EXPENSE_TAXONOMY);
  const err = (k: keyof Errors) => errors[k];
  const known = new Set(Object.entries(taxonomy).flatMap(([main, subs]) => ["other", ...subs].map((s) => joinCategory(main, s))));
  const recentKeys = new Set(recent.map((r) => joinCategory(r.main, r.sub)));
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

      <AmountField
        id="entry-amount"
        value={amount}
        onChange={setAmount}
        error={err("amount") ?? err("currency")}
        inputRef={amountRef}
        currency={currency}
        onCurrency={type === "transfer" ? null : setCurrency}
      />
      {currency !== "TWD" ? <p className="entry-n" aria-live="polite">{twdPreview(amount, rate?.key === rateKey ? rate.value : undefined)}</p> : null}

      {type === "transfer" && live.length < 2 ? (
        <p className="entry-n" id="entry-transfer-need">
          轉帳要在兩個帳戶之間移動，請先到「設定 → 帳戶」建立至少兩個帳戶。
        </p>
      ) : type === "transfer" ? (
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
            <select id="entry-category" value={category} onChange={(e) => { setCategory(e.target.value); setCategoryTouched(true); }} aria-describedby="entry-category-err">
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
              {Object.entries(taxonomy).map(([main, subs]) => {
                // 常用 already lists these; listing them again would put the same choice in the picker twice.
                const rest = ["other", ...subs].filter((s) => type !== "expense" || !recentKeys.has(joinCategory(main, s)));
                return rest.length === 0 ? null : (
                  <optgroup key={main} label={main}>
                    {rest.map((s) => (
                      <option key={s} value={joinCategory(main, s)}>
                        {main}／{subLabel(s)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
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
        <input id="entry-notes" value={notes} onChange={(e) => changeNotes(e.target.value)} placeholder="選填" autoComplete="off" aria-describedby="entry-notes-err" />
      </Field>

      {type !== "transfer" ? (
        <p className="entry-as" aria-live="polite">
          記為{" "}
          <button type="button" className="ghost" onClick={() => document.getElementById("entry-category")?.focus()}>
            {category === "" ? "（尚未選科目）" : `${splitCategory(category).main}／${subLabel(splitCategory(category).sub)}`}
          </button>
        </p>
      ) : null}
      <p className="entry-n">{KIND_NOTE[type]}</p>
      <p className="fld-err form-err" aria-live="polite">
        {err("form")}
      </p>
      <button id="entry-save" type="button" className="btn" disabled={pending || (type === "transfer" && live.length < 2)} onClick={save}>
        儲存
      </button>
    </>
  );
}

/** The line under a foreign amount; `rate` undefined while it is being looked up. */
function twdPreview(amount: string, rate: number | null | undefined): string {
  const n = parseAmountInput(amount);
  if (rate === undefined) return "換算中…";
  if (rate === null) return "查不到匯率，這筆暫不計入收支";
  return n === null ? `匯率 ${rate}` : `≈ NT$${formatAmount(Math.round(n * rate))}（匯率 ${rate}）`;
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
