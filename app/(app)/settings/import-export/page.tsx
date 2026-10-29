import Link from "next/link";
import { ImportExport } from "@/components/settings/ImportExport";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";

export default function ImportExportPage() {
  return (
    <>
      <Run label="匯入・匯出" />
      <Head
        title="匯入・匯出"
        aside={
          <Link className="act" href="/settings">
            回設定
          </Link>
        }
      />
      <ImportExport />
    </>
  );
}
