import Link from "next/link";
import { AccountManager } from "@/components/settings/AccountManager";
import { AlertRow } from "@/components/paper/AlertRow";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { ReconcileForm } from "@/components/recon/ReconcileForm";
import { ReconTable } from "@/components/recon/ReconTable";
import { accountBalance } from "@/lib/domain/balances";
import { buildRecon } from "@/lib/domain/recon";
import { reconcile, reconcileHint } from "@/lib/domain/reconcile";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listEntries } from "@/lib/server/repos/entries";
import { listAllReconciliations } from "@/lib/server/repos/reconciliations";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, toKanji, twToday } from "@/lib/time";

/** 帳戶：餘額與對帳（帳簿／實際／差額），輸入實際餘額，以及新增與封存帳戶。 */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const { a } = await searchParams;
  const userId = await getUserId();
  const client = await createServerClient();
  const accounts = await listAccounts(client, userId);
  const live = accounts.filter((x) => !x.archived);
  const today = twToday();
  const start = accounts.reduce((min, x) => (x.opening_date < min ? x.opening_date : min), today);
  const [entries, reconciliations] =
    accounts.length > 0 ? await Promise.all([listEntries(client, userId, { start, end: today }), listAllReconciliations(client, userId)]) : [[], []];
  const recon = buildRecon({ accounts: live, entries, reconciliations });
  const differing = recon.rows.filter((r) => r.matched === false);
  const { month } = currentMonth();

  return (
    <>
      <Run label={`${toKanji(month)}月　帳戶`} />
      <Head
        month={month}
        title="帳戶"
        aside={
          <Link className="act" href="/settings">
            回設定
          </Link>
        }
      />
      {live.length > 0 ? (
        <>
          <h2 className="sec">對帳</h2>
          <ReconTable recon={recon} linkAccounts />
          {differing.map((r) => (
            <AlertRow key={r.id} tone="action" href="/ledger" actionLabel="查看帳目">
              <strong>{r.name}</strong> {reconcile(r.kind, r.book, r.statement ?? 0).sentence}，{reconcileHint(r.kind, r.diff ?? 0)}
            </AlertRow>
          ))}
          <h2 className="sec">輸入實際餘額</h2>
          <ReconcileForm initialAccountId={a} accounts={live.map((x) => ({ id: x.id, name: x.name, kind: x.kind, book: accountBalance(x, entries) }))} />
        </>
      ) : (
        <Hint>建立帳戶後，就能在這裡輸入銀行或信用卡上的實際餘額，跟帳簿對帳。</Hint>
      )}
      <h2 className="sec">帳戶清單</h2>
      <AccountManager today={today} accounts={accounts.map((x) => ({ id: x.id, name: x.name, kind: x.kind, archived: x.archived, balance: accountBalance(x, entries) }))} />
    </>
  );
}
