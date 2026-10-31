import { CloseView } from "@/components/close/CloseView";
import { Head } from "@/components/paper/Head";
import { MonthNav } from "@/components/paper/MonthNav";
import { Run } from "@/components/paper/Run";
import { accountsClose, budgetClose } from "@/lib/domain/month-end";
import { latestByAccount } from "@/lib/domain/recon";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listBudgets } from "@/lib/server/repos/budgets";
import { listEntries } from "@/lib/server/repos/entries";
import { listAllReconciliations } from "@/lib/server/repos/reconciliations";
import { createServerClient } from "@/lib/server/supabase";
import { monthRange, resolveMonth, shiftMonth, toKanji, twToday } from "@/lib/time";

/** 月結: one month's accounts (start → end, reconciled?) and budgets (left over → carried into next month), on one spread. */
export default async function ClosePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { year, month } = resolveMonth((await searchParams).m);
  const range = monthRange(year, month);
  const next = shiftMonth(year, month, 1);
  const userId = await getUserId();
  const client = await createServerClient();
  const accounts = await listAccounts(client, userId);
  const start = accounts.reduce((min, a) => (a.opening_date < min ? a.opening_date : min), range.start);
  const [entries, budgets, nextBudgets, reconciliations] = await Promise.all([
    listEntries(client, userId, { start, end: range.end }),
    listBudgets(client, userId, year, month),
    listBudgets(client, userId, next.year, next.month),
    listAllReconciliations(client, userId),
  ]);
  const latest = latestByAccount(reconciliations);
  const monthEntries = entries.filter((e) => e.entry_date >= range.start);
  return (
    <>
      <span className="spread" hidden />
      <Run label={`${toKanji(month)}月　月結`} />
      <Head month={month} title="月結" />
      <MonthNav year={year} month={month} path="/close" />
      <CloseView
        year={year}
        month={month}
        next={next}
        monthStart={range.start}
        monthEnd={range.end}
        today={twToday()}
        accounts={accountsClose(accounts, entries, range).map((a) => {
          const r = latest.get(a.id);
          return { ...a, recon: r ? { date: r.statement_date, diff: r.diff } : null };
        })}
        budgets={budgetClose(budgets, nextBudgets, entries, range)}
        otherCount={monthEntries.filter((e) => e.entry_type === "expense" && e.main_category === "其他").length}
      />
    </>
  );
}
