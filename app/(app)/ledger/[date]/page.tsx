import { notFound, permanentRedirect } from "next/navigation";
import { isRealDate } from "@/lib/time";

/** Day pages are gone: the ledger writes every entry on its own line. Land on that day's first line. */
export default async function OldDay({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isRealDate(date)) notFound();
  permanentRedirect(`/ledger?m=${date.slice(0, 7)}#d-${date.slice(8, 10)}`);
}
