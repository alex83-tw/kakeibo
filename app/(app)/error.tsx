"use client";

import { Failure } from "@/components/paper/Failure";

/** 某一頁讀不到資料：導覽和左頁還在，只換掉右頁。 */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  return <Failure error={error} retry={retry} />;
}
