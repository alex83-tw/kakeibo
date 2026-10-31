import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonth, monthRange, twToday } from "@/lib/time";
import { DEFAULT_USER_ID } from "@/lib/server/auth";

/**
 * Development-only in-memory stand-in for the database, so pages can be exercised in a real browser
 * without a Supabase session. Enabled only when NODE_ENV === "development" and KAKEIBO_DEV_FIXTURES=1.
 * It implements just the query-builder calls the repositories use; it is not a PostgREST emulator.
 */
export const FIXTURE_USER = DEFAULT_USER_ID;

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

export function fixturesEnabled(env: { NODE_ENV: string; KAKEIBO_DEV_FIXTURES?: string }): boolean {
  return env.NODE_ENV === "development" && env.KAKEIBO_DEV_FIXTURES === "1";
}

let counter = 0;
const uid = () => `fx-${++counter}`;

function seed(): Store {
  const today = twToday();
  const { year, month } = currentMonth();
  const { start } = monthRange(year, month);
  const day = (d: number) => start.slice(0, 8) + String(d).padStart(2, "0");
  const e = (entry_date: string, entry_type: string, main_category: string, sub_category: string | null, amount: number, extra: Row = {}): Row => ({
    id: uid(), user_id: FIXTURE_USER, entry_type, main_category, sub_category, amount, currency: "TWD", entry_date,
    notes: null, account_id: "acc-cash", transfer_account_id: null, deleted_at: null, is_recurring: false,
    created_at: `${entry_date}T08:00:00Z`, ...extra,
  });
  const accounts = [
    { id: "acc-cash", kind: "cash", name: "現金", opening_balance: 5000, sort_order: 0 },
    { id: "acc-bank", kind: "bank", name: "銀行", opening_balance: 60000, sort_order: 1 },
    { id: "acc-card", kind: "credit_card", name: "信用卡", opening_balance: -2000, sort_order: 2 },
  ].map((a) => ({ ...a, user_id: FIXTURE_USER, opening_date: `${year}-01-01`, archived: false }));
  return {
    ledger_accounts: accounts,
    accounting_entries: [
      e(day(1), "income", "薪資", "other", 58000, { account_id: "acc-bank", notes: "十月薪水" }),
      e(day(2), "expense", "居住", "房租", 12000, { account_id: "acc-bank" }),
      e(day(3), "expense", "餐飲", "午餐", 180, { notes: "便當，加了滷蛋與一杯很長很長的飲料名稱" }),
      e(day(3), "expense", "餐飲", "飲料", 60),
      e(day(5), "expense", "交通", "捷運", 1280, { account_id: "acc-card" }),
      e(day(7), "expense", "日用購物", null, 960),
      e(day(9), "transfer", "轉帳", "other", 3000, { account_id: "acc-bank", transfer_account_id: "acc-cash" }),
      e(day(12), "expense", "餐飲", "晚餐", 420, { account_id: "acc-card" }),
      e(day(15), "expense", "其他", "other", 350),
      e(today, "expense", "餐飲", "午餐", 120),
      e(today, "expense", "餐飲", "咖啡", 85, { account_id: "acc-card" }),
      e(day(4), "expense", "餐飲", "午餐", 25, { currency: "JPY", notes: "自動販賣機" }),
    ],
    budget_plans: [
      { main_category: "餐飲", budget_amount: 6000, rollover_amount: 0, warning_threshold: 0.8 },
      { main_category: "交通", budget_amount: 2000, rollover_amount: 300, warning_threshold: 0.8 },
      { main_category: "居住", budget_amount: 13000, rollover_amount: 0, warning_threshold: 0.9 },
    ].map((b) => ({ id: uid(), user_id: FIXTURE_USER, sub_category: "other", currency: "TWD", period_year: year, period_month: month, ...b })),
    exchange_rates: [
      { from_currency: "JPY", to_currency: "TWD", rate: 0.21, date: `${year}-01-01` },
      { from_currency: "USD", to_currency: "TWD", rate: 31.5, date: `${year}-01-01` },
    ],
    reconciliations: [],
    category_rules: [],
    recurring_rules: [
      { id: uid(), user_id: FIXTURE_USER, label: "房租", entry_type: "expense", main_category: "居住", sub_category: "房租", amount_twd_min: 12000, amount_twd_max: 12000, frequency: "monthly", anchor_month: null, start_date: "2026-01-02", end_date: null, is_active: true },
      { id: uid(), user_id: FIXTURE_USER, label: "網路", entry_type: "expense", main_category: "居住", sub_category: "網路", amount_twd_min: 599, amount_twd_max: 699, frequency: "monthly", anchor_month: null, start_date: "2026-01-01", end_date: null, is_active: true },
    ],
  };
}

const g = globalThis as unknown as { __kakeibo_fixtures?: Store };
const store = (): Store => (g.__kakeibo_fixtures ??= seed());

type Mode = "select" | "insert" | "update" | "upsert" | "delete";

class Query implements PromiseLike<{ data: Row[]; error: { message: string } | null }> {
  private mode: Mode = "select";
  private payload: Row = {};
  private batch: Row[] = [];
  private filters: ((r: Row) => boolean)[] = [];
  private sorts: { col: string; asc: boolean }[] = [];
  private window: [number, number] | null = null;
  private conflict: string[] = [];

  constructor(private table: string) {}

  select() {
    return this;
  }
  insert(row: Row | Row[]) {
    this.mode = "insert";
    this.batch = Array.isArray(row) ? row : [row];
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  upsert(row: Row | Row[], opts: { onConflict: string }) {
    this.mode = "upsert";
    this.batch = Array.isArray(row) ? row : [row];
    this.conflict = opts.onConflict.split(",");
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  is(col: string, v: null) {
    this.filters.push((r) => (r[col] ?? null) === v);
    return this;
  }
  gte(col: string, v: string | number) {
    this.filters.push((r) => (r[col] as string | number) >= v);
    return this;
  }
  gt(col: string, v: string | number) {
    this.filters.push((r) => (r[col] as string | number) > v);
    return this;
  }
  lte(col: string, v: string | number) {
    this.filters.push((r) => (r[col] as string | number) <= v);
    return this;
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[col]));
    return this;
  }
  range(from: number, to: number) {
    this.window = [from, to];
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ col, asc: opts?.ascending ?? true });
    return this;
  }

  then<R1 = { data: Row[]; error: { message: string } | null }, R2 = never>(
    onfulfilled?: ((v: { data: Row[]; error: { message: string } | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run(): { data: Row[]; error: { message: string } | null } {
    const rows = (store()[this.table] ??= []);
    if (this.mode === "insert") {
      const made: Row[] = [];
      for (const payload of this.batch) {
        // UNIQUE(user_id, keyword) on the real table
        if (this.table === "category_rules" && rows.some((r) => r.user_id === payload.user_id && r.keyword === payload.keyword)) {
          return { data: [], error: { message: 'duplicate key value violates unique constraint "category_rules_user_id_keyword_key"' } };
        }
        const row: Row = { id: uid(), created_at: new Date().toISOString(), deleted_at: null, ...payload };
        // reconciliations.diff is a generated column in the real database
        if (this.table === "reconciliations") row.diff = Number(row.book_balance) - Number(row.statement_balance);
        rows.push(row);
        made.push(row);
      }
      return { data: made, error: null };
    }
    if (this.mode === "upsert") {
      for (const payload of this.batch) {
        const same = rows.find((r) => this.conflict.every((c) => r[c] === payload[c]));
        if (same) Object.assign(same, payload);
        else rows.push({ id: uid(), created_at: new Date().toISOString(), rollover_amount: 0, ...payload });
      }
      return { data: [], error: null };
    }
    const hit = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.mode === "delete") {
      store()[this.table] = rows.filter((r) => !hit.includes(r));
      return { data: hit, error: null };
    }
    if (this.mode === "update") {
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: hit, error: null };
    }
    const sorted = [...hit].sort((a, b) => {
      for (const { col, asc } of this.sorts) {
        const x = a[col] as string | number, y = b[col] as string | number;
        if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1);
      }
      return 0;
    });
    return { data: this.window ? sorted.slice(this.window[0], this.window[1] + 1) : sorted, error: null };
  }
}

type Args = Record<string, string | null>;

/** The same selection the SQL functions use: this user's rows of `kind` under main[/sub]. */
function matching(table: string, a: Args): Row[] {
  const rows = store()[table] ?? [];
  return rows.filter((r) => {
    if (r.user_id !== FIXTURE_USER) return false;
    if (table !== "budget_plans" && r.entry_type !== a.p_kind) return false;
    const mainKey = "main_category";
    if (r[mainKey] !== a.p_from_main && r[mainKey] !== a.p_main) return false;
    const sub = (r.sub_category ?? "other") as string;
    const want = a.p_from_sub !== undefined ? a.p_from_sub : a.p_sub;
    return want === null || want === undefined || sub === want;
  });
}

function rpc(name: string, a: Args): { data: Record<string, number>; error: null } {
  const count = (t: string) => matching(t, a).filter((r) => t !== "accounting_entries" || r.deleted_at == null).length;
  if (name === "category_usage") {
    return { data: { entries: count("accounting_entries"), budgets: a.p_kind === "expense" ? count("budget_plans") : 0, rules: count("category_rules"), recurring: count("recurring_rules") }, error: null };
  }
  const wholeMain = a.p_from_sub === null;
  const same = a.p_from_main === a.p_to_main && (wholeMain || a.p_from_sub === a.p_to_sub);
  const out = { entries: 0, budgets: 0, rules: 0, recurring: 0, budget_conflicts: 0 };
  if (same) return { data: out, error: null };
  const move = (t: string) => {
    const hit = matching(t, a);
    hit.forEach((r) => {
      r.main_category = a.p_to_main;
      if (!wholeMain) r.sub_category = a.p_to_sub;
    });
    return hit;
  };
  out.entries = move("accounting_entries").filter((r) => r.deleted_at == null).length;
  out.rules = move("category_rules").length;
  out.recurring = move("recurring_rules").length;
  if (a.p_kind === "expense") {
    const plans = store().budget_plans;
    for (const b of matching("budget_plans", a)) {
      out.budgets++;
      const newSub = wholeMain ? b.sub_category : a.p_to_sub;
      const t = plans.find((x) => x !== b && x.user_id === b.user_id && x.period_year === b.period_year && x.period_month === b.period_month && x.main_category === a.p_to_main && x.sub_category === newSub);
      if (!t) {
        b.main_category = a.p_to_main;
        b.sub_category = newSub;
      } else if (t.currency === b.currency) {
        t.budget_amount = Number(t.budget_amount) + Number(b.budget_amount);
        plans.splice(plans.indexOf(b), 1);
      } else out.budget_conflicts++;
    }
  }
  return { data: out, error: null };
}

export function fixtureClient(): SupabaseClient {
  return {
    rpc: async (name: string, args: Args) => rpc(name, args),
    from: (table: string) => new Query(table),
  } as unknown as SupabaseClient;
}

export function resetFixtures() {
  g.__kakeibo_fixtures = seed();
}
