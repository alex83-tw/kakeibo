"use client";

import { useState, useTransition } from "react";
import { removeRate, saveRate, syncRates } from "@/app/actions/rates";
import { useToast } from "@/components/ui/Toast";
import { daysBetween, RATE_CURRENCIES } from "@/lib/domain/rates";
import type { RateRecord } from "@/lib/server/repos/rates";

const STALE_DAYS = 3;

export function RateManager({ records, today }: { records: RateRecord[]; today: string }) {
  const [currency, setCurrency] = useState<string>(RATE_CURRENCIES[0]);
  const [date, setDate] = useState(today);
  const [rate, setRate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const { show, clear } = useToast();

  const run = (job: () => Promise<{ ok: boolean; message?: string; errors?: Record<string, string | undefined> }>, after?: () => void) =>
    start(async () => {
      setMsg("");
      const res = await job();
      if (!res.ok) return setErrors((res.errors ?? {}) as Record<string, string>);
      setErrors({});
      setMsg(res.message ?? "已儲存");
      after?.();
    });

  return (
    <>
      <p className="r hint">外幣帳目用「當天」的匯率換成台幣；某天沒有匯率就用最近的一天。</p>
      <ul className="acc-list">
        {RATE_CURRENCIES.map((c) => {
          const last = records.find((r) => r.currency === c);
          const stale = last ? daysBetween(last.date, today) > STALE_DAYS : true;
          return (
            <li key={c} className="acc">
              <span>
                <b>{c}</b> <span className="note">{last ? `1 ${c} = ${last.rate} TWD（${last.date}）` : "還沒有匯率，會用固定的預設值"}</span>
              </span>
              {stale ? <span className="fld-err">{last ? `已 ${daysBetween(last.date, today)} 天沒更新` : "缺少資料"}</span> : null}
            </li>
          );
        })}
      </ul>

      <div className="gap" />
      <h2 className="sec">從 Yahoo Finance 更新</h2>
      <div className="form-block">
        <button type="button" className="btn" disabled={pending} onClick={() => run(() => syncRates(7))}>
          更新最近 7 天
        </button>
        <button type="button" className="ghost" disabled={pending} onClick={() => run(() => syncRates(365))}>
          補回一整年
        </button>
        <p className="fld-err" aria-live="polite">
          {errors.form}
        </p>
        <p className="note" aria-live="polite">
          {msg}
        </p>
      </div>

      <div className="gap" />
      <h2 className="sec">手動輸入</h2>
      <div className="form-block">
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="rt-cur">幣別</label>
            <select id="rt-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {RATE_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="rt-date">日期</label>
            <input id="rt-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <p className="fld-err" aria-live="polite">
            {errors.date}
          </p>
        </div>
        <div className="fld-wrap">
          <div className="fld">
            <label htmlFor="rt-rate">匯率</label>
            <input id="rt-rate" inputMode="decimal" placeholder="1 單位換幾元台幣" value={rate} onChange={(e) => setRate(e.target.value)} autoComplete="off" />
          </div>
          <p className="fld-err" aria-live="polite">
            {errors.rate}
          </p>
        </div>
        <button type="button" className="btn" disabled={pending} onClick={() => run(() => saveRate({ currency, date, rate }), () => setRate(""))}>
          儲存這天的匯率
        </button>
      </div>

      <div className="gap" />
      <h2 className="sec">最近的匯率</h2>
      {records.length === 0 ? (
        <p className="r hint">資料表裡還沒有匯率。</p>
      ) : (
        <ul className="acc-list">
          {records.map((r) => (
            <li key={`${r.currency}-${r.date}`} className="acc">
              <span>
                {r.date} <b>{r.currency}</b> <span className="note">{r.rate}{r.source ? `・${r.source === "yahoo-finance" ? "Yahoo" : r.source === "manual" ? "手動" : r.source}` : ""}</span>
              </span>
              <button
                type="button"
                className="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    () => removeRate(r.currency, r.date),
                    () =>
                      show({
                        text: `已刪除 ${r.date} ${r.currency} 的匯率`,
                        action: {
                          label: "復原",
                          run: async () => {
                            clear();
                            const back = await saveRate({ currency: r.currency, date: r.date, rate: String(r.rate) });
                            show({ text: back.ok ? "已復原" : "復原失敗，請重新輸入這天的匯率" });
                          },
                        },
                      }),
                  )
                }
              >
                刪除<span className="sr">：{r.date} {r.currency}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
