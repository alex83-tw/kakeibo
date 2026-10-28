import Link from "next/link";
import { RecurringManager, type RecurringItem } from "@/components/settings/RecurringManager";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { subLabel } from "@/lib/domain/categories";
import { ruleName } from "@/lib/domain/recurring";
import { getUserId } from "@/lib/server/auth";
import { listRecurring } from "@/lib/server/repos/rules";
import { createServerClient } from "@/lib/server/supabase";
import { formatAmount } from "@/lib/money";
import { currentMonth, toKanji } from "@/lib/time";

const FREQUENCY: Record<string, string> = { monthly: "每月", quarterly: "每季", annual: "每年" };

export default async function RecurringSettingsPage() {
  const rules = await listRecurring(await createServerClient(), await getUserId());
  const { month } = currentMonth();
  const items: RecurringItem[] = rules.map((r) => ({
    id: r.id,
    name: ruleName(r),
    category: `${r.main_category}／${subLabel(r.sub_category)}`,
    amount: r.amount_twd_min === r.amount_twd_max ? formatAmount(r.amount_twd_min) : `${formatAmount(r.amount_twd_min)}～${formatAmount(r.amount_twd_max)}`,
    schedule: `${FREQUENCY[r.frequency] ?? r.frequency} ${Number(r.start_date.slice(8, 10))} 日`,
    active: r.is_active,
  }));
  return (
    <>
      <Run label={`${toKanji(month)}月　週期帳目`} />
      <div className="rows">
        <Head
          month={month}
          title="週期帳目"
          aside={
            <Link className="act" href="/settings">
              回設定
            </Link>
          }
        />
        <RecurringManager items={items} />
        <div className="gap" />
      </div>
    </>
  );
}
