import type { ReactNode } from "react";
import { BookmarkNav } from "@/components/nav/BookmarkNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BookmarkNav />
      <div className="page">
        <main className="sheet">{children}</main>
      </div>
    </>
  );
}
