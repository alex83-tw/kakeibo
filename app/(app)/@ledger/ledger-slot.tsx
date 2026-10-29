import { LedgerPane } from "@/components/ledger/LedgerPane";
import { pathOf } from "@/lib/text";
import { currentMonth, parseMonthParam } from "@/lib/time";

/** The left page on every route (`page.tsx` serves /, `[...rest]/page.tsx` the rest; an optional catch-all next to the page at / is a route conflict in Next 16): the ledger of `?m=` (default this month). Month links keep the current path. */
export default async function LedgerSlot({ params, searchParams }: { params: Promise<{ rest?: string[] }>; searchParams: Promise<{ m?: string }> }) {
  const [{ rest }, { m }] = await Promise.all([params, searchParams]);
  const target = (typeof m === "string" && parseMonthParam(m)) || currentMonth();
  return <LedgerPane year={target.year} month={target.month} path={pathOf(rest)} />;
}
