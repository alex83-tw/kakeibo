"use client";

import { useState, useTransition } from "react";
import { closeMonth } from "@/app/actions/month-end";

export function CloseButton({ year, month, closed, nextLabel }: { year: number; month: number; closed: boolean; nextLabel: string }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await closeMonth({ year, month });
            setMsg(res.ok ? `已結轉 ${res.carried} 項到${nextLabel}${res.created > 0 ? `（其中 ${res.created} 項是新建的預算）` : ""}` : res.error);
          })
        }
      >
        {closed ? "重新結轉" : `結轉到${nextLabel}`}
      </button>
      <p className="note" aria-live="polite">
        {msg}
      </p>
    </>
  );
}
