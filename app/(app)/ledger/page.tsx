import Link from "next/link";
import { notFound } from "next/navigation";
import { LedgerBook } from "@/components/ledger/LedgerBook";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { buildLedger } from "@/lib/domain/ledger";
import { formatAmount } from "@/lib/money";
import { getUserId } from "@/lib/server/auth";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, monthRange, parseMonthParam, shiftMonth, toKanji, twToday } from "@/lib/time";

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const target = m === undefined ? currentMonth() : parseMonthParam(m);
  if (!target) notFound();
  const { year, month } = target;

  const today = twToday();
  const range = monthRange(year, month);
  const entries = await listEntries(await createServerClient(), await getUserId(), range);
  const ledger = buildLedger({ year, month, entries, today });
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <>
      <Run label={`${toKanji(month)}月　帳本`} />
      <div className="rows">
        <Head
          month={month}
          title="帳本"
          aside={
            <span className="sub">
              收入 {formatAmount(ledger.income)}　支出 {formatAmount(ledger.expense)}
              <br />
              淨額 {ledger.net < 0 ? "△" : "＋"}
              {formatAmount(ledger.net)}
            </span>
          }
        />
        <nav className="mnav" aria-label="切換月份">
          <Link href={`/ledger?m=${ym(prev.year, prev.month)}`}>
            ◀ <span className="sr">上個月：</span>
            {toKanji(prev.month)}月
          </Link>
          <span aria-current="date">
            {year} 年 {toKanji(month)}月
          </span>
          <Link href={`/ledger?m=${ym(next.year, next.month)}`}>
            <span className="sr">下個月：</span>
            {toKanji(next.month)}月 ▶
          </Link>
        </nav>

        <LedgerBook ledger={ledger} year={year} month={month} />
        <div className="gap" />
      </div>
    </>
  );
}
