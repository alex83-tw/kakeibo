"use client";

import { useState } from "react";
import { createAccount } from "@/app/actions/accounts";

/** 還沒有任何帳戶時，直接在今日頁建立第一個（現金）：帳戶合計與對帳都要有帳戶才算得出來。 */
export function FirstAccount({ today }: { today: string }) {
  const [name, setName] = useState("現金");
  const [balance, setBalance] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    const res = await createAccount({ kind: "cash", name, opening_balance: balance, opening_date: today });
    setPending(false);
    if (!res.ok) return setErrors(res.errors as Record<string, string>);
    setErrors({});
  }

  return (
    <div className="form-block">
      <p className="r hint">還沒有帳戶。建立一個，並填入手上現有的餘額，帳戶合計和對帳才算得出來。</p>
      <div className="fld-wrap">
        <div className="fld">
          <label htmlFor="fa-name">名稱</label>
          <input id="fa-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-describedby="fa-name-err" />
        </div>
        <p id="fa-name-err" className="fld-err" aria-live="polite">
          {errors.name}
        </p>
      </div>
      <div className="fld-wrap">
        <div className="fld">
          <label htmlFor="fa-bal">餘額</label>
          <input id="fa-bal" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} autoComplete="off" placeholder="今天的實際餘額" aria-describedby="fa-bal-err" />
        </div>
        <p id="fa-bal-err" className="fld-err" aria-live="polite">
          {errors.opening_balance ?? errors.form}
        </p>
      </div>
      <button type="button" className="btn" onClick={create} disabled={pending}>
        建立帳戶
      </button>
    </div>
  );
}
