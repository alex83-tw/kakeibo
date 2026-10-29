import Link from "next/link";
import { BudgetBook, type BudgetBookRow } from "@/components/settings/BudgetBook";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { spentByMain } from "@/lib/domain/balances";
import { EXPENSE_TAXONOMY } from "@/lib/domain/categories";
import { getUserId } from "@/lib/server/auth";
import { listBudgets } from "@/lib/server/repos/budgets";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, monthRange, toKanji } from "@/lib/time";

export default async function BudgetSettingsPage() {
  const { year, month } = currentMonth();
  const client = await createServerClient();
  const userId = await getUserId();
  const range = monthRange(year, month);
  const [budgets, entries] = await Promise.all([listBudgets(client, userId, year, month), listEntries(client, userId, range)]);
  const byMain = new Map(budgets.map((b) => [b.main_category, b]));
  const spent = spentByMain(entries, range);

  // A category is on the page if it has a budget or has spending this month, so 已用 always adds up to the ledger.
  const taxonomy = Object.keys(EXPENSE_TAXONOMY);
  const used = new Set([...byMain.keys(), ...Object.keys(spent).filter((m) => spent[m] > 0)]);
  const mains = [...taxonomy.filter((m) => used.has(m)), ...[...used].filter((m) => !taxonomy.includes(m)).sort()];
  const rows: BudgetBookRow[] = mains.map((m) => {
    const b = byMain.get(m);
    return {
      main: m,
      amount: b?.budget_amount ?? null,
      available: b ? b.budget_amount + b.rollover_amount : 0,
      spent: spent[m] ?? 0,
      thresholdPct: Math.round((b?.warning_threshold ?? 0.8) * 100),
    };
  });

  return (
    <>
      <Run label={`${toKanji(month)}月　預算`} />
      <div className="rows">
        <Head
          month={month}
          title="預算"
          aside={
            <Link className="act" href="/settings">
              回設定
            </Link>
          }
        />
        <Hint>點金額直接改，離開欄位就存；清空＝取消這項預算。提醒%＝用到幾成時提醒。</Hint>
        <BudgetBook year={year} month={month} rows={rows} addable={taxonomy.filter((m) => !used.has(m))} hasAny={budgets.length > 0} />
        <div className="gap" />
      </div>
    </>
  );
}
