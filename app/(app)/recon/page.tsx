import Link from "next/link";
import { ReconcileForm } from "@/components/recon/ReconcileForm";
import { ReconTable } from "@/components/recon/ReconTable";
import { AlertRow } from "@/components/paper/AlertRow";
import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { accountBalance } from "@/lib/domain/balances";
import { buildRecon } from "@/lib/domain/recon";
import { reconcile, reconcileHint } from "@/lib/domain/reconcile";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listEntries } from "@/lib/server/repos/entries";
import { listAllReconciliations } from "@/lib/server/repos/reconciliations";
import { createServerClient } from "@/lib/server/supabase";
import { currentMonth, toKanji, twToday } from "@/lib/time";

export default async function ReconPage() {
  const userId = await getUserId();
  const client = await createServerClient();
  const accounts = (await listAccounts(client, userId)).filter((a) => !a.archived);
  const { month } = currentMonth();

  if (accounts.length === 0) {
    return (
      <>
        <Run label={`${toKanji(month)}月　對帳`} />
        <div className="rows">
          <Head month={month} title="對帳" />
          <Hint>
            還沒有帳戶，<Link href="/settings">先到設定建立</Link>。
          </Hint>
        </div>
      </>
    );
  }

  const start = accounts.reduce((min, a) => (a.opening_date < min ? a.opening_date : min), twToday());
  const [entries, reconciliations] = await Promise.all([
    listEntries(client, userId, { start, end: twToday() }),
    listAllReconciliations(client, userId),
  ]);
  const recon = buildRecon({ accounts, entries, reconciliations });
  const differing = recon.rows.filter((r) => r.matched === false);

  return (
    <>
      <Run label={`${toKanji(month)}月　對帳`} />
      <div className="rows">
        <Head
          month={month}
          title="對帳"
          aside={
            <span className="sub">
              {recon.matchedCount} 戶對上
              <br />
              {recon.differingCount} 戶有差{recon.unreconciledCount > 0 ? `　${recon.unreconciledCount} 戶未對帳` : ""}
            </span>
          }
        />
        <div className="gap" />
        <ReconTable recon={recon} />
        {differing.map((r) => (
          <AlertRow key={r.id} tone="action" href="/ledger" actionLabel="查看帳目">
            <strong>{r.name}</strong> {reconcile(r.kind, r.book, r.statement ?? 0).sentence}，{reconcileHint(r.kind, r.diff ?? 0)}
          </AlertRow>
        ))}
        <Hint>表中是各帳戶最近一次對帳時的數字。</Hint>

        <div className="gap" />
        <h2 className="sec">輸入帳單餘額</h2>
        <ReconcileForm accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, book: accountBalance(a, entries) }))} />
        <div className="gap" />
      </div>
    </>
  );
}
