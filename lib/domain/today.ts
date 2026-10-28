import { formatAmount, roundToTen } from "@/lib/money";
import { dayOfMonth, monthRange } from "@/lib/time";
import { findAbnormal, findDuplicates, topAlerts, type Alert } from "./alerts";
import { accountBalance, dailyExpenses, spentByMain, totalBalance } from "./balances";
import { budgetProgress } from "./budget";
import { isUncategorized } from "./categories";
import { reconcile } from "./reconcile";
import { latestByAccount, type ReconciliationRecord } from "./recon";
import type { Entry, LedgerAccount } from "./types";

export interface BudgetInput {
  main_category: string;
  budget_amount: number;
  rollover_amount: number;
  warning_threshold: number;
}

export interface TodayView {
  todayRows: Entry[];
  todayExpense: number;
  accounts: { id: string; name: string; kind: LedgerAccount["kind"]; balance: number }[];
  totalBalance: number;
  /** null when no budget is set for the month */
  budget: null | { spent: number; available: number; budget: number; percent: number; projected: number; overall: "over" | "projected-over" | "ok" };
  /** expense per day of the month, TWD only */
  daily: number[];
  alerts: Alert[];
}

const nt = (n: number) => `NT$ ${formatAmount(n)}`;

/** Everything the 今日 page shows, from plain data. `entries` must cover each account's opening date through today. */
export function buildToday(input: {
  today: string;
  entries: Entry[];
  accounts: LedgerAccount[];
  budgets: BudgetInput[];
  reconciliations: ReconciliationRecord[];
}): TodayView {
  const { today, entries, budgets } = input;
  const accounts = input.accounts.filter((a) => !a.archived);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const range = monthRange(year, month);
  const elapsed = dayOfMonth(today);

  const live = entries.filter((e) => e.deleted_at === null);
  const twd = live.filter((e) => e.currency === "TWD");
  const monthTwd = twd.filter((e) => e.entry_date >= range.start && e.entry_date <= range.end);

  const todayRows = live.filter((e) => e.entry_date === today);
  const todayExpense = twd
    .filter((e) => e.entry_date === today && e.entry_type === "expense")
    .reduce((s, e) => s + e.amount, 0);

  const spent = spentByMain(entries, range);
  const progress = budgets.map((b) => ({
    b,
    p: budgetProgress({
      budget: b.budget_amount,
      rollover: b.rollover_amount,
      spent: spent[b.main_category] ?? 0,
      warningThreshold: b.warning_threshold,
      daysElapsed: elapsed,
      daysInMonth: range.days,
    }),
    spent: spent[b.main_category] ?? 0,
  }));

  let budget: TodayView["budget"] = null;
  if (budgets.length > 0) {
    const totalSpent = progress.reduce((s, x) => s + x.spent, 0);
    const available = progress.reduce((s, x) => s + x.p.available, 0);
    const overall = budgetProgress({
      budget: budgets.reduce((s, b) => s + b.budget_amount, 0),
      rollover: budgets.reduce((s, b) => s + b.rollover_amount, 0),
      spent: totalSpent,
      warningThreshold: 1,
      daysElapsed: elapsed,
      daysInMonth: range.days,
    });
    budget = {
      spent: totalSpent,
      available,
      budget: budgets.reduce((s, b) => s + b.budget_amount, 0),
      percent: available > 0 ? Math.round((totalSpent / available) * 100) : 0,
      projected: overall.projected,
      overall: overall.status === "over" ? "over" : overall.status === "projected-over" ? "projected-over" : "ok",
    };
  }

  const alerts: Alert[] = [];
  const mk = (a: Omit<Alert, "text"> & { subject: string; body: string }): Alert => ({
    ...a,
    text: [a.subject, a.body, a.emphasis].filter(Boolean).join(" "),
  });

  for (const { b, p, spent: s } of progress) {
    const href = "/ledger";
    if (p.status === "over") {
      alerts.push(mk({ kind: "budget-over", subject: b.main_category, body: "已超支", emphasis: nt(s - p.available), href, actionLabel: `查看${b.main_category}` }));
    } else if (p.status === "projected-over") {
      alerts.push(mk({ kind: "budget-projected", subject: b.main_category, body: "預估月底超支", emphasis: nt(Math.max(10, roundToTen(p.projected - p.available))), href, actionLabel: `查看${b.main_category}` }));
    } else if (p.status === "warning") {
      alerts.push(mk({ kind: "budget-warning", subject: b.main_category, body: `已用 ${Math.round(p.ratio * 100)}%，接近預算`, href, actionLabel: `查看${b.main_category}` }));
    }
  }

  const latest = latestByAccount(input.reconciliations);
  for (const a of accounts) {
    const r = latest.get(a.id);
    if (!r) continue;
    const res = reconcile(a.kind, r.book_balance, r.statement_balance);
    if (res.matched) continue;
    alerts.push(mk({ kind: "reconcile", subject: a.name, body: "", emphasis: res.sentence, href: "/recon", actionLabel: "去對帳" }));
  }

  const uncategorized = monthTwd.filter((e) => e.entry_type !== "transfer" && isUncategorized(e.main_category, e.sub_category)).length;
  if (uncategorized > 0) alerts.push(mk({ kind: "uncategorized", subject: `${uncategorized} 筆`, body: "帳目未歸類", href: "/ledger", actionLabel: "去歸類" }));

  const dupes = findDuplicates(monthTwd);
  if (dupes.length > 0) alerts.push(mk({ kind: "duplicate", subject: `${dupes.length} 組`, body: "疑似重複帳目", href: "/ledger", actionLabel: "去檢查" }));

  const abnormal = findAbnormal(twd, today)[0];
  if (abnormal) alerts.push(mk({ kind: "abnormal", subject: abnormal.main_category, body: "今日金額偏高", emphasis: nt(abnormal.amount), href: "/ledger", actionLabel: "去確認" }));

  return {
    todayRows,
    todayExpense,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: accountBalance(a, entries) })),
    totalBalance: totalBalance(accounts, entries),
    budget,
    daily: dailyExpenses(entries, range),
    alerts: topAlerts(alerts, 3),
  };
}
