import Link from "next/link";
import { ImportExport } from "@/components/settings/ImportExport";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { currentMonth, toKanji } from "@/lib/time";

export default function ImportExportPage() {
  const { month } = currentMonth();
  return (
    <>
      <Run label={`${toKanji(month)}月　匯入・匯出`} />
      <div className="rows">
        <Head
          month={month}
          title="匯入・匯出"
          aside={
            <Link className="act" href="/settings">
              回設定
            </Link>
          }
        />
        <ImportExport />
        <div className="gap" />
      </div>
    </>
  );
}
