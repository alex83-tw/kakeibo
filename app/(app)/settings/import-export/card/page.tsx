import Link from "next/link";
import { BatchImport } from "@/components/settings/BatchImport";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { createServerClient } from "@/lib/server/supabase";

export default async function CardImportPage() {
  const accounts = (await listAccounts(await createServerClient(), await getUserId())).filter((a) => !a.archived);
  return (
    <>
      <Run label="信用卡明細" />
      <Head
        title="信用卡明細"
        aside={
          <Link className="act" href="/settings/import-export">
            回匯入・匯出
          </Link>
        }
      />
      <BatchImport accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} />
    </>
  );
}
