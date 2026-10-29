import { entriesToCsv } from "@/lib/domain/csv";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { twToday } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Live TWD entries only: the CSV has no currency column, so a foreign amount would re-import as TWD. */
export async function GET() {
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return new Response("請先登入", { status: 401 });
  }
  const client = await createServerClient();
  const [entries, accounts] = await Promise.all([
    listEntries(client, userId, { start: "0001-01-01", end: "9999-12-31" }),
    listAccounts(client, userId),
  ]);
  const csv = entriesToCsv(entries.filter((e) => e.currency === "TWD" && !e.foreign), accounts);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kakeibo-${twToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
