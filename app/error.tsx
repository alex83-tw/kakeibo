"use client";

import { Failure } from "@/components/paper/Failure";

/** 整個 layout 讀不到資料時（例如資料庫連不上）：沒有導覽可用，自己撐一張紙。 */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="solo">
      <main className="pane">
        <Failure error={error} retry={retry} />
      </main>
    </div>
  );
}
