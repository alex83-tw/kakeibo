import { formatAmount, roundToTen } from "@/lib/money";
import { dayOfMonth, monthRange } from "@/lib/time";
import { findAbnormal, findDuplicates, findMissingRecurring, topAlerts, type Alert } from "./alerts";
import { accountBalance, dailyExpenses, spentByMain, totalBalance } from "./balances";
import { budgetProgress, type BudgetProgress } from "./budget";
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
  /** One row per budgeted main category; `budget` includes rollover, so budget − spent = progress.remaining. */
  budgetRows: { main: string; budget: number; spent: number; progress: BudgetProgress }[];
  /** This month's spending in categories with no budget, largest first. Budget progress never sees it. */
  unbudgeted: { total: number; rows: { main: string; spent: number }[] };
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
  /** Active monthly recurring items, as dueRules() returns them. */
  recurring?: { id: string; name: string; due_day: number; main?: string; sub?: string }[];
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

  const budgeted = new Set(budgets.map((b) => b.main_category));
  const unbudgetedRows = Object.entries(spent)
    .filter(([main, s]) => !budgeted.has(main) && s > 0)
    .map(([main, s]) => ({ main, spent: s }))
    .sort((a, b) => b.spent - a.spent);

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

  // One budget alert row, however many categories are off: several rows would fill the three slots and push
  // the bookkeeping alerts (duplicates, missed recurring items) out of sight. The detail lives on the budget page.
  const href = "/settings/budget";
  const flagged: { main: string; kind: "budget-over" | "budget-projected" | "budget-warning"; one: Omit<Alert, "text"> & { subject: string; body: string } }[] = [];
  for (const { b, p, spent: s } of progress) {
    if (p.status === "over") {
      flagged.push({ main: b.main_category, kind: "budget-over", one: { kind: "budget-over", subject: b.main_category, body: "已超支", emphasis: nt(s - p.available), href, actionLabel: "看預算" } });
    } else if (p.status === "projected-over") {
      flagged.push({ main: b.main_category, kind: "budget-projected", one: { kind: "budget-projected", subject: b.main_category, body: "預估月底超支", emphasis: nt(Math.max(10, roundToTen(p.projected - p.available))), href, actionLabel: "看預算" } });
    } else if (p.status === "warning") {
      flagged.push({ main: b.main_category, kind: "budget-warning", one: { kind: "budget-warning", subject: b.main_category, body: `已用 ${Math.round(p.ratio * 100)}%，接近預算`, href, actionLabel: "看預算" } });
    }
  }
  if (flagged.length === 1) {
    alerts.push(mk(flagged[0].one));
  } else if (flagged.length > 1) {
    const names = (k: (typeof flagged)[number]["kind"]) => flagged.filter((f) => f.kind === k).map((f) => f.main).join("、");
    const parts = [
      ["budget-over", "超支"],
      ["budget-projected", "預估超支"],
      ["budget-warning", "接近預算"],
    ].flatMap(([k, word]) => (names(k as (typeof flagged)[number]["kind"]) ? [`${names(k as (typeof flagged)[number]["kind"])} ${word}`] : []));
    const worst = flagged.some((f) => f.kind === "budget-over") ? "budget-over" : flagged.some((f) => f.kind === "budget-projected") ? "budget-projected" : "budget-warning";
    alerts.push(mk({ kind: worst, subject: `${flagged.length} 個科目`, body: parts.join("；"), href, actionLabel: "看預算" }));
  }

  const latest = latestByAccount(input.reconciliations);
  for (const a of accounts) {
    const r = latest.get(a.id);
    if (!r) continue;
    const res = reconcile(a.kind, r.book_balance, r.statement_balance);
    if (res.matched) continue;
    alerts.push(mk({ kind: "reconcile", subject: a.name, body: "", emphasis: res.sentence, href: "/recon", actionLabel: "去對帳" }));
  }

  // Each alert lands on the page that shows the offending rows, not on the whole book.
  const day = (date: string) => `/ledger/${date}`;

  const uncategorizedRows = monthTwd.filter((e) => e.entry_type !== "transfer" && isUncategorized(e.main_category, e.sub_category));
  if (uncategorizedRows.length > 0) {
    const first = uncategorizedRows.reduce((a, e) => (e.entry_date < a ? e.entry_date : a), uncategorizedRows[0].entry_date);
    alerts.push(mk({ kind: "uncategorized", subject: `${uncategorizedRows.length} 筆`, body: "帳目未歸類", href: day(first), actionLabel: "去歸類" }));
  }

  const dupes = findDuplicates(monthTwd);
  if (dupes.length > 0) alerts.push(mk({ kind: "duplicate", subject: `${dupes.length} 組`, body: "疑似重複帳目", href: day(dupes[0][0].entry_date), actionLabel: "去檢查" }));

  const abnormal = findAbnormal(twd, today)[0];
  if (abnormal) alerts.push(mk({ kind: "abnormal", subject: abnormal.main_category, body: "今日金額偏高", emphasis: nt(abnormal.amount), href: day(today), actionLabel: "去確認" }));

  for (const r of findMissingRecurring(input.recurring ?? [], monthTwd, today)) {
    alerts.push(
      mk({
        kind: "missing-recurring",
        subject: r.name,
        body: "本月還沒記帳",
        href: "/settings/recurring",
        actionLabel: "去記帳",
        preset: r.main ? { main: r.main, sub: r.sub ?? "other", notes: r.name } : undefined,
      }),
    );
  }

  // Balances are "as of today"; a future-dated entry this month counts for the month's budget, not for what is in the account now.
  const sofar = entries.filter((e) => e.entry_date <= today);

  return {
    todayRows,
    todayExpense,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: accountBalance(a, sofar) })),
    totalBalance: totalBalance(accounts, sofar),
    budget,
    budgetRows: progress.map(({ b, p, spent: s }) => ({ main: b.main_category, budget: p.available, spent: s, progress: p })),
    unbudgeted: { total: unbudgetedRows.reduce((s, r) => s + r.spent, 0), rows: unbudgetedRows },
    daily: dailyExpenses(entries, range),
    alerts: topAlerts(alerts, 3),
  };
}
