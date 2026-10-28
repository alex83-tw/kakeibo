import type { ReactNode } from "react";

/** 兩行高的說明小字（鋪紙色，避免行線穿過文字）。 */
export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="r hint" id={id}>
      {children}
    </p>
  );
}
