"use server";

import { revalidatePath } from "next/cache";
import { accountBalance } from "@/lib/domain/balances";
import { reconcile } from "@/lib/domain/reconcile";
import { parseAmountInput } from "@/lib/money";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { listEntries } from "@/lib/server/repos/entries";
import { insertReconciliation } from "@/lib/server/repos/reconciliations";
import { createServerClient } from "@/lib/server/supabase";
import { isRealDate, twToday } from "@/lib/time";

export type ReconResult = { ok: true; diff: number; matched: boolean } | { ok: false; error: string };

export async function saveReconciliation(input: {
  account_id: string;
  statement_date: string;
  statement: string;
}): Promise<ReconResult> {
  const statement = parseAmountInput(input.statement);
  if (statement === null) return { ok: false, error: "請輸入數字" };
  if (!isRealDate(input.statement_date)) return { ok: false, error: "日期不正確" };

  try {
    const userId = await getUserId();
    const client = await createServerClient();
    const account = (await listAccounts(client, userId)).find((a) => a.id === input.account_id);
    if (!account) return { ok: false, error: "找不到這個帳戶" };

    // The book balance is computed here from the ledger, never taken from the browser.
    const entries = await listEntries(client, userId, { start: account.opening_date, end: twToday() });
    const book = accountBalance(account, entries);
    const { diff, matched } = reconcile(account.kind, book, statement);

    await insertReconciliation(client, userId, {
      account_id: account.id,
      statement_date: input.statement_date,
      statement_balance: statement,
      book_balance: book,
    });
    revalidatePath("/", "layout");
    return { ok: true, diff, matched };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, error: "請先登入" };
    return { ok: false, error: "儲存失敗，請稍後再試" };
  }
}
