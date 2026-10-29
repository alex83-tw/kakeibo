import { LineButton } from "@/components/ledger/LineButton";
import { Hint } from "@/components/paper/Hint";
import { subLabel } from "@/lib/domain/categories";
import type { Entry } from "@/lib/domain/types";
import { formatAmount } from "@/lib/money";
import { foldWidth } from "@/lib/text";

function amountCell(e: Entry): string {
  if (e.currency !== "TWD") return "未納入";
  if (e.entry_type === "transfer") return `(${formatAmount(e.amount)})`;
  return e.entry_type === "income" ? `＋${formatAmount(e.amount)}` : formatAmount(e.amount);
}

/** Today's entries, one per line; a line opens its entry for editing. */
export function TodayBlock({ rows, accountNames }: { rows: Entry[]; accountNames: Record<string, string> }) {
  const name = (id: string | null) => (id ? (accountNames[id] ?? "") : "");
  if (rows.length === 0) return <Hint>今天還沒有帳目。按「記一筆」開始。</Hint>;
  return (
    <table className={rows.some((e) => e.account_id) ? "rt rt-today" : "rt rt-today no-a"}>
      <caption className="sr">今日明細；點一行可以修改或刪除</caption>
      <thead>
        <tr>
          <th scope="col">科目</th>
          <th scope="col">摘要</th>
          <th scope="col" className="c-a">
            帳戶
          </th>
          <th scope="col" className="n">
            金額
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const title = e.entry_type === "transfer" ? "轉帳" : `${e.main_category}／${subLabel(e.sub_category ?? "other")}`;
          return (
            <tr key={e.id}>
              <td className="c">
                <LineButton entry={e}>
                  {title}
                  <span className="sr">，{amountCell(e)}，修改或刪除</span>
                </LineButton>
              </td>
              <td className="dim">{foldWidth(e.notes ?? "")}</td>
              <td className="c-a dim">{e.entry_type === "transfer" ? `${name(e.account_id)}→${name(e.transfer_account_id)}` : name(e.account_id)}</td>
              <td className={e.currency === "TWD" && e.entry_type !== "transfer" ? "n" : "n dim"}>{amountCell(e)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
