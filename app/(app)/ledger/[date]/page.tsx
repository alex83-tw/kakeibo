import Link from "next/link";
import { notFound } from "next/navigation";
import { DayEntries } from "@/components/ledger/DayEntries";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { TotalLine } from "@/components/paper/TotalLine";
import { loadEntryChrome } from "@/lib/server/chrome";
import { getUserId } from "@/lib/server/auth";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { dayOfMonth, isRealDate, toKanji, twToday, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isRealDate(date)) notFound();
  const month = Number(date.slice(5, 7));

  const [entries, chrome] = await Promise.all([
    getUserId().then(async (id) => listEntries(await createServerClient(), id, { start: date, end: date })),
    loadEntryChrome(),
  ]);
  const spent = entries.filter((e) => e.currency === "TWD" && e.entry_type === "expense").reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <Run label={`${toKanji(month)}月　明細`} />
      <div className="rows">
        <Head
          month={month}
          title={
            <>
              {toKanji(dayOfMonth(date))}日<span className="wd">{WEEKDAY_JP[weekdayIndex(date)]}曜</span>
            </>
          }
          aside={
            <Link className="act" href={`/ledger?m=${date.slice(0, 7)}`}>
              回帳本
            </Link>
          }
        />
        <TotalLine label={date === twToday() ? "今日支出合計" : "當日支出合計"} amount={spent} />
        {entries.length === 0 ? (
          <Hint>這天沒有帳目。</Hint>
        ) : (
          <DayEntries entries={entries} accounts={chrome.accounts} recentCategories={chrome.recentCategories} />
        )}
        <div className="gap" />
      </div>
    </>
  );
}
