import Link from "next/link";
import { RecurringManager, type RecurringItem } from "@/components/settings/RecurringManager";
import { RecurringSuggestions } from "@/components/settings/RecurringSuggestions";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { subLabel } from "@/lib/domain/categories";
import { anchorMonth, ruleName } from "@/lib/domain/recurring";
import { detectRecurring } from "@/lib/domain/recurring-detect";
import { getUserId } from "@/lib/server/auth";
import { listEntries } from "@/lib/server/repos/entries";
import { listRecurring } from "@/lib/server/repos/rules";
import { createServerClient } from "@/lib/server/supabase";
import { formatAmount } from "@/lib/money";
import { shiftMonth, twToday } from "@/lib/time";

const FREQUENCY: Record<string, string> = { monthly: "每月", quarterly: "每季", annual: "每年" };

export default async function RecurringSettingsPage() {
  const client = await createServerClient();
  const userId = await getUserId();
  const today = twToday();
  const from = shiftMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)), -11);
  const [rules, entries] = await Promise.all([listRecurring(client, userId), listEntries(client, userId, { start: `${from.year}-${String(from.month).padStart(2, "0")}-01`, end: today })]);
  const suggestions = detectRecurring(entries, rules, today);
  const items: RecurringItem[] = rules.map((r) => ({
    id: r.id,
    name: ruleName(r),
    category: `${r.main_category}／${subLabel(r.sub_category)}`,
    amount: r.amount_twd_min === r.amount_twd_max ? formatAmount(r.amount_twd_min) : `${formatAmount(r.amount_twd_min)}～${formatAmount(r.amount_twd_max)}`,
    schedule: `${FREQUENCY[r.frequency] ?? r.frequency}${r.frequency === "monthly" ? "" : ` ${r.frequency === "annual" ? anchorMonth(r) : [0, 3, 6, 9].map((n) => ((anchorMonth(r) - 1 + n) % 12) + 1).sort((a, b) => a - b).join("、")} 月`} ${Number(r.start_date.slice(8, 10))} 日`,
    active: r.is_active,
  }));
  return (
    <>
      <Run label="週期帳目" />
      <Head
        title="週期帳目"
        aside={
          <Link className="act" href="/settings">
            回設定
          </Link>
        }
      />
      <RecurringSuggestions suggestions={suggestions} />
      <RecurringManager items={items} />
    </>
  );
}
