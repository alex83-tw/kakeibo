import type { ReactNode } from "react";
import { EntrySheet } from "@/components/entry/EntrySheet";
import { BookmarkNav } from "@/components/nav/BookmarkNav";
import { loadEntryChrome } from "@/lib/server/chrome";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { accounts, recentCategories } = await loadEntryChrome();
  return (
    <>
      <BookmarkNav />
      <div className="page">
        <main className="sheet">
          {children}
          <EntrySheet accounts={accounts} recentCategories={recentCategories} />
        </main>
      </div>
    </>
  );
}
