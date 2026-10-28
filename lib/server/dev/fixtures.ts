import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonth, monthRange, twToday } from "@/lib/time";

/**
 * Development-only in-memory stand-in for the database, so pages can be exercised in a real browser
 * without a Supabase session. Enabled only when NODE_ENV === "development" and KAKEIBO_DEV_FIXTURES=1.
 * It implements just the query-builder calls the repositories use; it is not a PostgREST emulator.
 */
export const FIXTURE_USER = "fixture-user";

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
    reconciliations: [],
    category_rules: [],
    recurring_rules: [],
  };
}

const g = globalThis as unknown as { __kakeibo_fixtures?: Store };
const store = (): Store => (g.__kakeibo_fixtures ??= seed());

type Mode = "select" | "insert" | "update";

class Query implements PromiseLike<{ data: Row[]; error: null }> {
  private mode: Mode = "select";
  private payload: Row = {};
  private filters: ((r: Row) => boolean)[] = [];
  private sorts: { col: string; asc: boolean }[] = [];
  private window: [number, number] | null = null;

  constructor(private table: string) {}

  select() {
    return this;
  }
  insert(row: Row) {
    this.mode = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
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

  then<R1 = { data: Row[]; error: null }, R2 = never>(
    onfulfilled?: ((v: { data: Row[]; error: null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run(): { data: Row[]; error: null } {
    const rows = (store()[this.table] ??= []);
    if (this.mode === "insert") {
      const row: Row = { id: uid(), created_at: new Date().toISOString(), deleted_at: null, ...this.payload };
      rows.push(row);
      return { data: [row], error: null };
    }
    const hit = rows.filter((r) => this.filters.every((f) => f(r)));
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

export function fixtureClient(): SupabaseClient {
  return {
    from: (table: string) => new Query(table),
    auth: { getUser: async () => ({ data: { user: { id: FIXTURE_USER } }, error: null }) },
  } as unknown as SupabaseClient;
}

export function resetFixtures() {
  g.__kakeibo_fixtures = seed();
}
