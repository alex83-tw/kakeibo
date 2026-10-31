"use client";

import { useMemo, useState } from "react";
import { applyBatch, previewBatch, type BatchRow } from "@/app/actions/batch-import";
import { softDeleteEntries } from "@/app/actions/entries";
import { createRule } from "@/app/actions/rules";
import { useCategoryOptions } from "@/components/entry/CategoryOptions";
import { useToast } from "@/components/ui/Toast";
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, subLabel } from "@/lib/domain/categories";
import { formatAmount } from "@/lib/money";

interface Row extends BatchRow {
  include: boolean;
}

export interface BatchAccount {
  id: string;
  name: string;
  kind: string;
}

const SHOWN_ERRORS = 20;
const key = (r: Pick<Row, "entry_type" | "main" | "sub">) => `${r.entry_type}::${r.main}::${r.sub}`;

/**
 * 貼上信用卡明細 → 看一遍（改科目與摘要、取消不要的、已在帳本的預設不匯入）→ 一起寫進選定的帳戶。
 * 寫入前伺服器會重新檢查每一列與重複；匯入後有 10 秒可以整批復原。
 */
export function BatchImport({ accounts }: { accounts: BatchAccount[] }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.kind === "credit_card")?.id ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rule, setRule] = useState<{ at: number; keyword: string } | null>(null);
  const { show, clear } = useToast();
  const options = useCategoryOptions();

  const groups = useMemo(() => {
    const tax = (kind: "expense" | "income") => options?.[kind] ?? (kind === "expense" ? EXPENSE_TAXONOMY : INCOME_TAXONOMY);
    return (["expense", "income"] as const).map((kind) => ({
      label: kind === "expense" ? "支出" : "收入",
      items: Object.entries(tax(kind)).flatMap(([main, subs]) => ["other", ...subs].map((sub) => ({ value: `${kind}::${main}::${sub}`, label: `${main}／${subLabel(sub)}` }))),
    }));
  }, [options]);
  const known = useMemo(() => new Set(groups.flatMap((g) => g.items.map((i) => i.value))), [groups]);

  const chosen = rows?.filter((r) => r.include) ?? [];

  async function parse() {
    setMessage("");
    setRows(null);
    setRule(null);
    setBusy(true);
    const res = await previewBatch(text);
    setBusy(false);
    if (!res.ok) return setMessage(res.error);
    setErrors(res.errors);
    setRows(res.rows.map((r) => ({ ...r, include: !r.duplicate })));
    if (res.rows.length === 0) setMessage(res.errors.length > 0 ? "" : "沒有看到帳目，請貼上網銀的明細表格。");
  }

  const patch = (i: number, p: Partial<Row>) => setRows((cur) => cur && cur.map((r, n) => (n === i ? { ...r, ...p } : r)));

  async function save() {
    setBusy(true);
    const res = await applyBatch(
      accountId,
      chosen.map((r) => ({ line: r.line, date: r.date, time: r.time, merchant: r.merchant, amount: r.amount, entry_type: r.entry_type, main: r.main, sub: r.sub, keepDuplicate: r.duplicate })),
    );
    setBusy(false);
    if (!res.ok) return setMessage(res.error);
    setRows(null);
    setText("");
    setErrors([]);
    setMessage(`已匯入 ${res.ids.length} 筆${res.skipped > 0 ? `，略過 ${res.skipped} 筆已在帳本的` : ""}。`);
    if (res.ids.length === 0) return;
    show({
      text: `已匯入 ${res.ids.length} 筆`,
      ms: 10000,
      action: {
        label: "復原",
        run: async () => {
          clear();
          const back = await softDeleteEntries(res.ids);
          show({ text: back.ok ? `已復原 ${back.ids.length} 筆` : "復原失敗，請到帳本選取刪除" });
        },
      },
    });
  }

  async function saveRule() {
    if (!rule || !rows) return;
    const r = rows[rule.at];
    const res = await createRule({ keyword: rule.keyword, entry_type: "expense", main_category: r.main, sub_category: r.sub });
    if (!res.ok) return show({ text: res.errors.keyword ?? res.errors.main_category ?? res.errors.form ?? "存不了這條規則" });
    show({ text: `已存規則「${rule.keyword.trim()}」→ ${r.main}／${subLabel(r.sub)}，之後貼上的明細會自動分類` });
    setRule(null);
  }

  const expense = chosen.filter((r) => r.entry_type === "expense").reduce((s, r) => s + r.amount, 0);
  const income = chosen.filter((r) => r.entry_type === "income").reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <div className="form-block">
        <p className="entry-n">
          從網銀的信用卡明細複製整張表（含表頭）貼上。金額欄是新台幣；負數（退款）會記成收入「其他／退款」。已在帳本裡、日期和金額相同的帳目預設不匯入。
        </p>
        <div className="fld-wrap">
          <div className="fld bi-text">
            <label htmlFor="bi-text">明細</label>
            <textarea id="bi-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={"消費時間\t摘要\t卡號末四碼\t新台幣金額\t消費地\t更多"} />
          </div>
        </div>
        <button type="button" className="btn" disabled={busy || text.trim() === ""} onClick={parse}>
          解析
        </button>
      </div>

      <p className="note" aria-live="polite">
        {message}
      </p>

      {errors.length > 0 ? (
        <ul className="note">
          {errors.slice(0, SHOWN_ERRORS).map((e) => (
            <li key={e.line}>
              第 {e.line} 行：{e.message}（略過）
            </li>
          ))}
          {errors.length > SHOWN_ERRORS ? <li>還有 {errors.length - SHOWN_ERRORS} 行…</li> : null}
        </ul>
      ) : null}

      {rows && rows.length > 0 ? (
        <>
          <h2 className="sec">確認</h2>
          <div className="form-block">
            <div className="fld-wrap">
              <div className="fld">
                <label htmlFor="bi-acct">帳戶</label>
                <select id="bi-acct" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">未指定</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ul className="bi" aria-label="明細">
              {rows.map((r, i) => (
                <li key={r.line} className={r.include ? "bi-r" : "bi-r off"}>
                  <div className="bi-l1">
                    <input type="checkbox" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} aria-label={`匯入 ${r.date} ${r.merchant || "無摘要"} ${formatAmount(r.amount)}`} />
                    <span className="dim">{r.date.slice(5).replace("-", "/")}</span>
                    <input className="bi-n" value={r.merchant} maxLength={200} placeholder="（無摘要）" onChange={(e) => patch(i, { merchant: e.target.value })} aria-label={`摘要 ${r.date}`} />
                    <b className="bi-a">{r.entry_type === "income" ? `＋${formatAmount(r.amount)}` : formatAmount(r.amount)}</b>
                  </div>
                  <div className="bi-l2">
                    <select
                      value={key(r)}
                      aria-label={`科目 ${r.date} ${r.merchant || ""}`}
                      onChange={(e) => {
                        const [entry_type, main, sub] = e.target.value.split("::");
                        patch(i, { entry_type: entry_type as Row["entry_type"], main, sub });
                      }}
                    >
                      {known.has(key(r)) ? null : <option value={key(r)}>{`${r.main}／${subLabel(r.sub)}`}</option>}
                      {groups.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map((it) => (
                            <option key={it.value} value={it.value}>
                              {it.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {r.duplicate ? <span className="bi-d">已在帳本</span> : null}
                    {r.entry_type === "expense" && r.merchant.trim() !== "" ? (
                      <button type="button" className="ghost" onClick={() => setRule({ at: i, keyword: r.merchant.trim() })}>
                        存為規則<span className="sr">：{r.merchant}</span>
                      </button>
                    ) : null}
                  </div>
                  {rule?.at === i ? (
                    <div className="bi-l2">
                      <input className="bi-n" value={rule.keyword} onChange={(e) => setRule({ at: i, keyword: e.target.value })} aria-label="規則的關鍵字" autoComplete="off" />
                      <button type="button" className="ghost" onClick={saveRule}>
                        儲存
                      </button>
                      <button type="button" className="ghost" onClick={() => setRule(null)}>
                        取消
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="note" aria-live="polite">
              將匯入 {chosen.length} 筆{expense > 0 ? `　支出 ${formatAmount(expense)}` : ""}
              {income > 0 ? `　收入 ${formatAmount(income)}` : ""}
            </p>
            <button type="button" className="btn" disabled={busy || chosen.length === 0} onClick={save}>
              匯入 {chosen.length} 筆
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
