import { notFound } from "next/navigation";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { spentByMain } from "@/lib/domain/balances";
import { EXPENSE_TAXONOMY } from "@/lib/domain/categories";
import { formatAmount, formatSigned } from "@/lib/money";
import { getUserId } from "@/lib/server/auth";
import { loadLedgerMonth } from "@/lib/server/ledger";
import { listBudgets } from "@/lib/server/repos/budgets";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, monthRange, parseMonthParam, toKanji } from "@/lib/time";

/**
 * /ledger: on a phone the 帳本 slot is the page and this is hidden; on the desktop spread it is the right page,
 * the month's spending by category against its budget.
 */
export default async function LedgerOverview({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const target = m === undefined ? currentMonth() : parseMonthParam(m);
  if (!target) notFound();
  const { year, month } = target;
  const range = monthRange(year, month);
  const [{ entries }, budgets] = await Promise.all([loadLedgerMonth(year, month), getUserId().then(async (id) => listBudgets(await createServerClient(), id, year, month))]);
  const spent = spentByMain(entries, range);
  const budgetOf = new Map(budgets.map((b) => [b.main_category, b.budget_amount + b.rollover_amount]));
  const taxonomy = Object.keys(EXPENSE_TAXONOMY);
  const used = new Set([...budgetOf.keys(), ...Object.keys(spent).filter((k) => spent[k] > 0)]);
  const mains = [...taxonomy.filter((k) => used.has(k)), ...[...used].filter((k) => !taxonomy.includes(k)).sort()];
  const total = mains.reduce((s, k) => s + (spent[k] ?? 0), 0);
  const totalBudget = [...budgetOf.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="lg-overview">
      <Run label={`${toKanji(month)}月　科目總覽`} />
      <Head month={month} title="科目總覽" />
      {mains.length === 0 ? (
        <Hint>這個月沒有支出，也沒有預算。</Hint>
      ) : (
        <table className="rt">
          <caption className="sr">
            {toKanji(month)}月各科目支出與預算
          </caption>
          <thead>
            <tr>
              <th scope="col">科目</th>
              <th scope="col" className="n">
                支出
              </th>
              <th scope="col" className="n">
                預算
              </th>
              <th scope="col" className="n">
                餘額
              </th>
            </tr>
          </thead>
          <tbody>
            {mains.map((k) => {
              const b = budgetOf.get(k);
              const left = b === undefined ? null : b - (spent[k] ?? 0);
              return (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td className="n">{spent[k] ? formatAmount(spent[k]) : "－"}</td>
                  <td className="n dim">{b === undefined ? "未設" : formatAmount(b)}</td>
                  <td className={left !== null && left < 0 ? "n bad" : "n"}>{left === null ? "" : formatSigned(left)}</td>
                </tr>
              );
            })}
            <tr className="sum">
              <th scope="row">合計</th>
              <td className="n">{formatAmount(total)}</td>
              <td className="n">{formatAmount(totalBudget)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
