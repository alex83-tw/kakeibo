import { entriesToCsv, entriesToJson } from "@/lib/domain/csv";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { twToday } from "@/lib/time";

export const dynamic = "force-dynamic";

/** `?year=2026` limits to one year; `?format=json` gives JSON instead of CSV. Live entries only; foreign ones keep their original currency and amount. */
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return new Response("請先登入", { status: 401 });
  }
  const q = new URL(req.url).searchParams;
  const year = /^\d{4}$/.test(q.get("year") ?? "") ? q.get("year") : null;
  const json = q.get("format") === "json";
  const client = await createServerClient();
  const [entries, accounts] = await Promise.all([
    listEntries(client, userId, year ? { start: `${year}-01-01`, end: `${year}-12-31` } : { start: "0001-01-01", end: "9999-12-31" }),
    listAccounts(client, userId),
  ]);
  const name = `kakeibo-${year ?? twToday()}.${json ? "json" : "csv"}`;
  return new Response(json ? JSON.stringify({ exported_at: twToday(), entries: entriesToJson(entries, accounts) }, null, 1) : `﻿${entriesToCsv(entries, accounts)}`, {
    headers: {
      "Content-Type": json ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
