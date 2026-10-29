import { LedgerPane } from "@/components/ledger/LedgerPane";
import { currentMonth } from "@/lib/time";

/** Fallback after a full load when the slot cannot recover its page: this month's ledger. */
export default function LedgerDefault() {
  const { year, month } = currentMonth();
  return <LedgerPane year={year} month={month} path="/ledger" />;
}
