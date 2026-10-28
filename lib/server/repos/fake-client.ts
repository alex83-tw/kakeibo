import type { SupabaseClient } from "@supabase/supabase-js";

/** Test double: records every query-builder call and resolves to `rows` when awaited. */
export function fakeClient(rows: unknown[] = [], error: { message: string } | null = null, rpcResult: unknown = null) {
  const calls: [string, ...unknown[]][] = [];
  let window: [number, number] | null = null;
  const builder: Record<string, unknown> = {
    then: (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) =>
      resolve({ data: error ? null : window ? rows.slice(window[0], window[1] + 1) : rows, error }),
    range: (from: number, to: number) => {
      calls.push(["range", from, to]);
      window = [from, to];
      return builder;
    },
  };
  for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "is", "gte", "lte", "order", "in"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  const client = {
    rpc: (name: string, args: unknown) => {
      calls.push(["rpc", name, args]);
      return Promise.resolve({ data: error ? null : rpcResult, error });
    },
    from: (table: string) => {
      calls.push(["from", table]);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
