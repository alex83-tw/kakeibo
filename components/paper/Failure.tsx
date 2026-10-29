"use client";

import { useEffect } from "react";
import { Hint } from "./Hint";
import { Run } from "./Run";

/** 讀取失敗的頁面內容（error.tsx 共用）：說明、再試一次。不顯示錯誤訊息本身，細節進 console。 */
export function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert">
      <Run label="讀取失敗" />
      <div className="head">
        <h1>讀不到資料</h1>
      </div>
      <Hint>網路或資料庫暫時連不上；已記好的帳目不受影響。</Hint>
      <button type="button" className="btn" onClick={retry}>
        再試一次
      </button>
    </div>
  );
}
