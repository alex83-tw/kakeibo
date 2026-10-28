import Link from "next/link";
import { BudgetEditor } from "@/components/settings/BudgetEditor";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { EXPENSE_TAXONOMY } from "@/lib/domain/categories";
import { getUserId } from "@/lib/server/auth";
import { listBudgets } from "@/lib/server/repos/budgets";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, toKanji } from "@/lib/time";

export default async function BudgetSettingsPage() {
  const { year, month } = currentMonth();
  const budgets = await listBudgets(await createServerClient(), await getUserId(), year, month);
  const byMain = new Map(budgets.map((b) => [b.main_category, b]));
  // Taxonomy order first, then any budgeted category that is not in it.
  const mains = [...Object.keys(EXPENSE_TAXONOMY), ...budgets.map((b) => b.main_category).filter((m) => !(m in EXPENSE_TAXONOMY))];

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
        <Hint>預算只設在主分類。每個月各自一份；新的一個月可以按「沿用上月」。</Hint>
        <BudgetEditor
          year={year}
          month={month}
          rows={mains.map((m) => ({
            main: m,
            amount: byMain.get(m)?.budget_amount ?? null,
            thresholdPct: Math.round((byMain.get(m)?.warning_threshold ?? 0.8) * 100),
          }))}
          hasAny={budgets.length > 0}
        />
        <div className="gap" />
      </div>
    </>
  );
}
