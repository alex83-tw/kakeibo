import { Block } from "@/components/paper/Block";
import { Hint } from "@/components/paper/Hint";
import { subLabel } from "@/lib/domain/categories";
import type { Entry } from "@/lib/domain/types";
import { formatAmount } from "@/lib/money";

function amountCell(e: Entry): string {
  if (e.currency !== "TWD") return "未納入";
  return e.entry_type === "income" ? `＋${formatAmount(e.amount)}` : formatAmount(e.amount);
}

/** Today's entries as a ruled table, or the empty-day hint. */
export function TodayBlock({ rows, accountNames }: { rows: Entry[]; accountNames: Record<string, string> }) {
  const name = (id: string | null) => (id ? (accountNames[id] ?? "—") : "—");
  return (
    <>
      {rows.length > 0 ? (
        <Block label="今日">
          <table className="ledger">
            <caption className="sr">今日明細</caption>
            <colgroup>
              <col style={{ width: 84 }} />
              <col />
              <col style={{ width: 52 }} />
              <col style={{ width: 62 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">科目</th>
                <th scope="col">摘要</th>
                <th scope="col">帳戶</th>
                <th scope="col" className="n">
                  金額
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.entry_type === "transfer" ? "轉帳" : `${e.main_category}／${subLabel(e.sub_category ?? "other")}`}
                  </td>
                  <td className="m">
                    <span className="clamp">{e.notes ?? ""}</span>
                  </td>
                  <td className="sm">
                    <span className="clamp">
                      {e.entry_type === "transfer" ? `${name(e.account_id)}→${name(e.transfer_account_id)}` : name(e.account_id)}
                    </span>
                  </td>
                  <td className="n">{amountCell(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : (
        <Hint>今天還沒有帳目。按下方「記一筆」開始。</Hint>
      )}
    </>
  );
}
