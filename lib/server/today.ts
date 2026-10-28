import { buildToday, type TodayView } from "@/lib/domain/today";
import { currentMonth, monthRange, shiftMonth, twToday } from "@/lib/time";
import { getUserId } from "./auth";
import { listAccounts } from "./repos/accounts";
import { listBudgets } from "./repos/budgets";
import { listEntries } from "./repos/entries";
import { listAllReconciliations } from "./repos/reconciliations";
import { createServerClient } from "./supabase";

export async function loadToday(): Promise<{
  view: TodayView;
  today: string;
  year: number;
  month: number;
  accountNames: Record<string, string>;
}> {
  const userId = await getUserId();
  const client = await createServerClient();
  const today = twToday();
  const { year, month } = currentMonth();

  const accounts = await listAccounts(client, userId);
  // Balances need every entry since each account's opening date; the abnormal-amount check needs six months.
  const sixAgo = shiftMonth(year, month, -6);
  const historyStart = monthRange(sixAgo.year, sixAgo.month).start;
  const start = accounts.reduce((min, a) => (a.opening_date < min ? a.opening_date : min), historyStart);

  const [entries, budgets, reconciliations] = await Promise.all([
    listEntries(client, userId, { start, end: monthRange(year, month).end }),
    listBudgets(client, userId, year, month),
    listAllReconciliations(client, userId),
  ]);

  return {
    view: buildToday({ today, entries, accounts, budgets, reconciliations }),
    today,
    year,
    month,
    accountNames: Object.fromEntries(accounts.map((a) => [a.id, a.name])),
  };
}
