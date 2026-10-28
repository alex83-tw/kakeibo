"use client";

import { useState } from "react";
import { archiveAccount, createAccount } from "@/app/actions/accounts";
import type { AccountKind } from "@/lib/domain/types";
import { formatSigned } from "@/lib/money";

const KIND_LABEL: Record<AccountKind, string> = { cash: "現金", bank: "銀行", e_wallet: "電子支付", credit_card: "信用卡" };

interface Item {
  id: string;
  name: string;
  kind: AccountKind;
  archived: boolean;
  balance: number;
}

export function AccountManager({ accounts, today }: { accounts: Item[]; today: string }) {
  const [kind, setKind] = useState<AccountKind>("cash");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function create() {
    setMsg("");
    const res = await createAccount({ kind, name, opening_balance: balance, opening_date: date });
    if (!res.ok) return setErrors(res.errors as Record<string, string>);
    setErrors({});
    setName("");
    setBalance("");
    setMsg("已建立帳戶");
  }

  const live = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <>
      {live.length === 0 ? (
        <p className="r hint">還沒有帳戶。先建立一個，並填入「截至某日的實際餘額」。</p>
      ) : (
        <ul className="acc-list">
          {live.map((a) => (
            <AccountRow key={a.id} a={a} />
          ))}
        </ul>
      )}

      <div className="gap" />
      <h2 className="sec">新增帳戶</h2>
      <div className="form-block">
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="acc-kind">種類</label>
            <select id="acc-kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Field id="acc-name" label="名稱" error={errors.name}>
          <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-describedby="acc-name-err" />
        </Field>
        <Field id="acc-bal" label="餘額" error={errors.opening_balance}>
          <input id="acc-bal" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} autoComplete="off" placeholder={kind === "credit_card" ? "欠款用 △，例如 △3,150" : "0"} aria-describedby="acc-bal-err" />
        </Field>
        <Field id="acc-date" label="截至" error={errors.opening_date}>
          <input id="acc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="acc-date-err" />
        </Field>
        <p className="entry-n">餘額填「截至那天的實際餘額」；只有那天之後的帳目會計入。</p>
        <p className="fld-err" aria-live="polite">
          {errors.form}
        </p>
        <button type="button" className="btn" onClick={create}>
          建立帳戶
        </button>
        <p className="note" aria-live="polite">
          {msg}
        </p>
      </div>

      {archived.length > 0 ? (
        <>
          <div className="gap" />
          <h2 className="sec">已封存</h2>
          <ul className="acc-list">
            {archived.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function AccountRow({ a }: { a: Item }) {
  const [err, setErr] = useState("");
  return (
    <li className="acc">
      <span>
        <b>{a.name}</b> <span className="note">{KIND_LABEL[a.kind]}</span>
      </span>
      <span className="acc-r">
        <span>{formatSigned(a.balance)}</span>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            const res = await archiveAccount(a.id, !a.archived);
            if (!res.ok) setErr(res.errors.form ?? "失敗");
          }}
        >
          {a.archived ? "取消封存" : "封存"}
          <span className="sr">：{a.name}</span>
        </button>
      </span>
      {err ? <span className="fld-err">{err}</span> : null}
    </li>
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
