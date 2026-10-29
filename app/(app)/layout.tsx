import type { ReactNode } from "react";
import { CategoryOptionsProvider } from "@/components/entry/CategoryOptions";
import { EntrySheet } from "@/components/entry/EntrySheet";
import { BookmarkNav } from "@/components/nav/BookmarkNav";
import { ToastProvider } from "@/components/ui/Toast";
import { loadEntryChrome } from "@/lib/server/chrome";

/**
 * 帳簿：電腦版是見開き（左頁帳本常駐、右頁是目前的網址），手機版一次一頁。
 * 兩種版面是同一份 DOM，由 CSS 切換；左頁由 @ledger slot 提供。
 */
export default async function AppLayout({ children, ledger }: { children: ReactNode; ledger: ReactNode }) {
  const { accounts, recentCategories, rules, categoryOptions } = await loadEntryChrome();
  return (
    <ToastProvider>
      <div className="book">
        <BookmarkNav />
        <CategoryOptionsProvider value={categoryOptions}>
          <section className="pane pane-l" aria-label="帳本">
            {ledger}
          </section>
          <main className="pane pane-r">{children}</main>
          <EntrySheet accounts={accounts} recentCategories={recentCategories} rules={rules} />
        </CategoryOptionsProvider>
      </div>
    </ToastProvider>
  );
}
