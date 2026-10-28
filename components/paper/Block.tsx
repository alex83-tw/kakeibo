import type { ReactNode } from "react";

/** 表罫區塊：左側直排欄標（網點底），右側放表格。 */
export function Block({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return (
    <div className="block" id={id}>
      <span className="vl" aria-hidden="true">
        <span>{label}</span>
      </span>
      {children}
    </div>
  );
}
