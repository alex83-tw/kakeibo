"use client";

import { useState } from "react";
import { saveReconciliation } from "@/app/actions/recon";
import { reconcile, reconcileHint } from "@/lib/domain/reconcile";
import type { AccountKind } from "@/lib/domain/types";
import { formatSigned, parseAmountInput } from "@/lib/money";
import { twToday } from "@/lib/time";

type Outcome = { sentence: string; hint: string; diff: number; matched: boolean } | { error: string };

export function ReconcileForm({ accounts, initialAccountId }: { accounts: { id: string; name: string; kind: AccountKind; book: number }[]; initialAccountId?: string }) {
  const [accountId, setAccountId] = useState(accounts.find((a) => a.id === initialAccountId)?.id ?? accounts[0]?.id ?? "");
  const [statement, setStatement] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return null;

  async function submit() {
    const parsed = parseAmountInput(statement);
    if (parsed === null) return setOutcome({ error: "請輸入數字" });
    setPending(true);
    const res = await saveReconciliation({ account_id: accountId, statement_date: twToday(), statement });
    setPending(false);
    if (!res.ok) return setOutcome({ error: res.error });
    // The server computed the book balance; rebuild the sentence from it so both always agree.
    const r = reconcile(account!.kind, parsed + res.diff, parsed);
    setOutcome({ sentence: r.sentence, hint: reconcileHint(account!.kind, res.diff), diff: res.diff, matched: res.matched });
  }

  const label = accounts.length > 1 ? "實際餘額" : `${account.name}　實際餘額`;
  return (
    <div id="recon-form">
      {accounts.length > 1 ? (
        <div className="chkrow">
          <label htmlFor="recon-account">帳戶</label>
          <select id="recon-account" value={accountId} onChange={(e) => { setAccountId(e.target.value); setOutcome(null); }}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="chkrow">
        <label htmlFor="recon-statement">{label}</label>
        <input
          id="recon-statement"
          inputMode="decimal"
          autoComplete="off"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          aria-describedby="recon-hint recon-result"
          aria-invalid={outcome && "error" in outcome ? true : undefined}
        />
        <button type="button" className="btn s2" disabled={pending} onClick={submit}>
          對帳
        </button>
      </div>
      <div id="recon-result" className="recon-result" aria-live="polite">
        {outcome && "error" in outcome ? (
          <p className="fld-err">{outcome.error}</p>
        ) : outcome ? (
          outcome.matched ? (
            <p>
              <span className="ok">對上</span>
            </p>
          ) : (
            <p>
              <span>{outcome.sentence}</span>
              {outcome.hint ? <span>，{outcome.hint}　</span> : "　"}
              <b className="bad">{formatSigned(outcome.diff)}</b>
            </p>
          )
        ) : null}
      </div>
      <p className="r hint" id="recon-hint">
        差額＝帳簿−實際，△ 代表帳簿較少（信用卡＝多欠）；對上顯示青緑「對上」
      </p>
    </div>
  );
}
