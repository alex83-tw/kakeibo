import Link from "next/link";
import { CategoryChangeForm } from "@/components/settings/CategoryChangeForm";
import { CategoryList } from "@/components/settings/CategoryList";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { categoryInventory } from "@/lib/domain/inventory";
import { getUserId } from "@/lib/server/auth";
import { listBudgets } from "@/lib/server/repos/budgets";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, monthRange, shiftMonth, twToday } from "@/lib/time";

export default async function CategoriesSettingsPage() {
  const { year, month } = currentMonth();
  const from = shiftMonth(year, month, -11);
  const client = await createServerClient();
  const userId = await getUserId();
  const [entries, budgets] = await Promise.all([
    listEntries(client, userId, { start: monthRange(from.year, from.month).start, end: twToday() }),
    listBudgets(client, userId, year, month),
  ]);
  const inventory = { expense: categoryInventory("expense", entries), income: categoryInventory("income", entries) };

  return (
    <>
      <Run label="科目" />
      <Head
        title="科目"
        aside={
          <Link className="act" href="/settings">
            回設定
          </Link>
        }
      />
      <Hint>改名或合併會一次更新帳目、預算、自動分類與週期帳目。舊帳目的科目也會跟著變。筆數是近 12 個月。</Hint>
      <CategoryList title="支出科目" mains={inventory.expense} budgeted={new Set(budgets.map((b) => b.main_category))} />
      <CategoryList title="收入科目" mains={inventory.income} />
      <h2 className="sec">改名・合併</h2>
      <CategoryChangeForm inventory={inventory} />
    </>
  );
}
