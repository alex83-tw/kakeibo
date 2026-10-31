import Link from "next/link";
import { RateManager } from "@/components/settings/RateManager";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { getUserId } from "@/lib/server/auth";
import { listRateRecords } from "@/lib/server/repos/rates";
import { createServerClient } from "@/lib/server/supabase";
import { twToday } from "@/lib/time";

export default async function RatesSettingsPage() {
  await getUserId();
  const records = await listRateRecords(await createServerClient(), 90);
  return (
    <>
      <Run label="匯率" />
      <Head
        title="匯率"
        aside={
          <Link className="act" href="/settings">
            回設定
          </Link>
        }
      />
      <RateManager records={records} today={twToday()} />
    </>
  );
}
