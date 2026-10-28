import Link from "next/link";
import { CategoryChangeForm } from "@/components/settings/CategoryChangeForm";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { categoryInventory } from "@/lib/domain/inventory";
import { getUserId } from "@/lib/server/auth";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, monthRange, shiftMonth, toKanji, twToday } from "@/lib/time";

export default async function CategoriesSettingsPage() {
  const { year, month } = currentMonth();
  const from = shiftMonth(year, month, -11);
  const entries = await listEntries(await createServerClient(), await getUserId(), {
    start: monthRange(from.year, from.month).start,
    end: twToday(),
  });
  const inventory = { expense: categoryInventory("expense", entries), income: categoryInventory("income", entries) };

  return (
    <>
      <Run label={`${toKanji(month)}月　科目`} />
      <div className="rows">
        <Head
          month={month}
          title="科目"
          aside={
            <Link className="act" href="/settings">
              回設定
            </Link>
          }
        />
        <Hint>改名或合併會一次更新帳目、預算、自動分類與週期帳目。舊帳目的科目也會跟著變。筆數是近 12 個月。</Hint>
        <CategoryChangeForm inventory={inventory} />
        <div className="gap" />
      </div>
    </>
  );
}
