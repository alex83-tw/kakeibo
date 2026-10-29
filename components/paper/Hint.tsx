import type { ReactNode } from "react";

/** 兩行高的說明小字（鋪紙色，避免行線穿過文字）。內容包成單一 span，句中的連結才不會被 flex 拆成三塊。 */
export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="r hint" id={id}>
      <span className="wrap">{children}</span>
    </p>
  );
}
