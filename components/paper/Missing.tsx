import Link from "next/link";
import { Hint } from "./Hint";
import { Run } from "./Run";

/** 找不到頁面（not-found.tsx 共用）。 */
export function Missing() {
  return (
    <>
      <Run label="找不到" />
      <div className="head">
        <h1>找不到這一頁</h1>
      </div>
      <Hint>
        網址可能打錯了，<Link href="/">回今日</Link>。
      </Hint>
    </>
  );
}
