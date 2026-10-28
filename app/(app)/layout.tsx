import type { ReactNode } from "react";
import { CategoryOptionsProvider } from "@/components/entry/CategoryOptions";
import { EntrySheet } from "@/components/entry/EntrySheet";
import { BookmarkNav } from "@/components/nav/BookmarkNav";
import { loadEntryChrome } from "@/lib/server/chrome";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { accounts, recentCategories, categoryOptions } = await loadEntryChrome();
  return (
    <>
      <BookmarkNav />
      <div className="page">
        <main className="sheet">
          <CategoryOptionsProvider value={categoryOptions}>
            {children}
            <EntrySheet accounts={accounts} recentCategories={recentCategories} />
          </CategoryOptionsProvider>
        </main>
      </div>
    </>
  );
}
