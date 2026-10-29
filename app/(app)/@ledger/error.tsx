"use client";

import { Failure } from "@/components/paper/Failure";

/** 左頁帳本讀不到資料：右頁照常，只有左頁顯示失敗。 */
export default function LedgerError({ error, retry }: { error: unknown; retry: () => void }) {
  return <Failure error={error} retry={retry} />;
}
