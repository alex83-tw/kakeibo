import Link from "next/link";
import { ReportView } from "@/components/reports/ReportView";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { readRange, type Period } from "@/lib/domain/reports";
import { getUserId } from "@/lib/server/auth";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, formatMonthParam, resolveMonth, toKanji } from "@/lib/time";

/** `?y=2026` is the year view; otherwise `?m=2026-10` (default: this month) is the month view. */
function resolvePeriod(sp: { m?: string; y?: string }): Period {
  const y = typeof sp.y === "string" && /^\d{4}$/.test(sp.y) ? Number(sp.y) : null;
  if (y !== null && y >= 2000 && y <= 2100) return { kind: "year", year: y };
  const { year, month } = resolveMonth(sp.m);
  return { kind: "month", year, month };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ m?: string; y?: string }> }) {
  const period = resolvePeriod(await searchParams);
  const entries = await listEntries(await createServerClient(), await getUserId(), readRange(period));
  const now = currentMonth();
  return (
    <>
      <span className="spread" hidden />
      <Run label={period.kind === "month" ? `${toKanji(period.month)}月　報表` : `${period.year}　報表`} />
      <Head
        month={period.kind === "month" ? period.month : undefined}
        title="報表"
        aside={
          period.kind === "month" ? (
            <Link className="act" href={`/close?m=${formatMonthParam(period.year, period.month)}`}>
              月結
            </Link>
          ) : null
        }
      />
      <ReportView period={period} entries={entries} thisMonth={now} />
    </>
  );
}
