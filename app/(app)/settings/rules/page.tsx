import Link from "next/link";
import { RuleManager, type RuleItem } from "@/components/settings/RuleManager";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { subLabel } from "@/lib/domain/categories";
import { getUserId } from "@/lib/server/auth";
import { listCategoryRules } from "@/lib/server/repos/rules";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, toKanji } from "@/lib/time";

export default async function RulesSettingsPage() {
  const rules = await listCategoryRules(await createServerClient(), await getUserId());
  const { month } = currentMonth();
  const items: RuleItem[] = rules.map((r) => ({ id: r.id, keyword: r.keyword, category: `${r.main_category}／${subLabel(r.sub_category)}` }));
  return (
    <>
      <Run label={`${toKanji(month)}月　自動分類`} />
      <Head
        month={month}
        title="自動分類"
        aside={
          <Link className="act" href="/settings">
            回設定
          </Link>
        }
      />
      <RuleManager items={items} />
    </>
  );
}
