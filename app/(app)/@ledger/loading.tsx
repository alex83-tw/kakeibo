import { Run } from "@/components/paper/Run";

/** 換頁讀取中：標題列先出現，橫線由 .pane 的背景提供。 */
export default function Loading() {
  return (
    <div role="status" aria-label="讀取中">
      <Run label="讀取中" />
      <div className="head" aria-hidden="true" />
    </div>
  );
}
