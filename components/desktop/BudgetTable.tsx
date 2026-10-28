import type { BudgetProgress } from "@/lib/domain/budget";
import { formatAmount, formatSigned, roundToTen } from "@/lib/money";

export interface BudgetTableRow {
  main: string;
  budget: number;
  spent: number;
  progress: BudgetProgress;
}

const overspent = (p: BudgetProgress) => p.status === "over" || p.status === "projected-over";

/** 各主分類的預算、已用、餘額、進度與月底預估；合計列由各列加總而來。 */
export function BudgetTable({ rows }: { rows: BudgetTableRow[] }) {
  const sum = (f: (r: BudgetTableRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const total = { budget: sum((r) => r.budget), spent: sum((r) => r.spent), projected: sum((r) => r.progress.projected) };
  const remaining = total.budget - total.spent;
  const totalOver = total.budget > 0 && total.projected > total.budget;
  return (
    <div className="block">
      <span className="vl" aria-hidden="true">
        <span>預算</span>
      </span>
      <table className="ledger bt">
        <caption className="sr">各主分類預算</caption>
        <thead>
          <tr>
            <th scope="col">科目</th>
            <th scope="col" className="n">預算</th>
            <th scope="col" className="n">已用</th>
            <th scope="col" className="n">餘額</th>
            <th scope="col" className="n">月底預估</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.main}>
              <th scope="row" className="bt-name">
                <span>{r.main}</span>
                <span className="bar" role="img" aria-label={`已用 ${Math.round(r.progress.ratio * 100)}%`}>
                  <i className={overspent(r.progress) ? "bad" : undefined} style={{ width: `${Math.min(100, r.progress.ratio * 100)}%` }} />
                </span>
              </th>
              <td className="n">{formatAmount(r.budget)}</td>
              <td className="n">{formatAmount(r.spent)}</td>
              <td className={r.progress.remaining < 0 ? "n bad" : "n"}>{formatSigned(r.progress.remaining)}</td>
              <td className={overspent(r.progress) ? "n bad" : "n"}>
                {formatAmount(roundToTen(r.progress.projected))}
                {r.progress.status === "over" ? "　已超支" : r.progress.status === "projected-over" ? "　預估超支" : ""}
              </td>
            </tr>
          ))}
          <tr className="sum">
            <th scope="row">合計</th>
            <td className="n">{formatAmount(total.budget)}</td>
            <td className="n">{formatAmount(total.spent)}</td>
            <td className={remaining < 0 ? "n bad" : "n"}>{formatSigned(remaining)}</td>
            <td className={totalOver ? "n bad" : "n"}>
              {formatAmount(roundToTen(total.projected))}
              {totalOver ? "　預估超支" : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
