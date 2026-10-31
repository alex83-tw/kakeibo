"use client";

import { useState, useTransition } from "react";
import { saveReconciliation } from "@/app/actions/recon";
import { formatAmount, formatSigned } from "@/lib/money";

/** One account's 對帳 without leaving the close: type what the statement or wallet really holds, and the book balance is compared to it. */
function Row({ id, name, book, date }: { id: string; name: string; book: number; date: string }) {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const field = `recon-${id}`;
  return (
    <div className="chkrow">
      <label htmlFor={field}>
        {name}　帳簿 {formatSigned(book)}　實際
      </label>
      <input id={field} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="實際餘額" autoComplete="off" />
      <button
        type="button"
        className="btn s2"
        disabled={pending || value.trim() === ""}
        onClick={() =>
          start(async () => {
            const res = await saveReconciliation({ account_id: id, statement_date: date, statement: value });
            setMsg(!res.ok ? res.error : res.matched ? "對上了" : `差 △${formatAmount(Math.abs(res.diff))}`);
          })
        }
      >
        對帳
      </button>
      <span className="lg-n" role="status">
        {msg}
      </span>
    </div>
  );
}

export function ReconInline({ accounts, date }: { accounts: { id: string; name: string; close: number }[]; date: string }) {
  return (
    <>
      {accounts.map((a) => (
        <Row key={a.id} id={a.id} name={a.name} book={a.close} date={date} />
      ))}
    </>
  );
}
