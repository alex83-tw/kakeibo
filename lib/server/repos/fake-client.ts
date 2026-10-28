import type { SupabaseClient } from "@supabase/supabase-js";

/** Test double: records every query-builder call and resolves to `rows` when awaited. */
export function fakeClient(rows: unknown[] = [], error: { message: string } | null = null) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) =>
      resolve({ data: error ? null : rows, error }),
  };
  for (const m of ["select", "eq", "is", "gte", "lte", "order", "in"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
