import Link from "next/link";
import { AccountManager } from "@/components/settings/AccountManager";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { accountBalance } from "@/lib/domain/balances";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listEntries } from "@/lib/server/repos/entries";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, toKanji, twToday } from "@/lib/time";

export default async function AccountsSettingsPage() {
  const userId = await getUserId();
  const client = await createServerClient();
  const accounts = await listAccounts(client, userId);
  const today = twToday();
  const start = accounts.reduce((min, a) => (a.opening_date < min ? a.opening_date : min), today);
  const entries = accounts.length > 0 ? await listEntries(client, userId, { start, end: today }) : [];
  const { month } = currentMonth();

  return (
    <>
      <Run label={`${toKanji(month)}月　帳戶`} />
      <div className="rows">
        <Head
          month={month}
          title="帳戶"
          aside={
            <Link className="act" href="/settings">
              回設定
            </Link>
          }
        />
        <AccountManager
          today={today}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, archived: a.archived, balance: accountBalance(a, entries) }))}
        />
        <div className="gap" />
      </div>
    </>
  );
}
