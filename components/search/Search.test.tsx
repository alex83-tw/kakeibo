import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Entry } from "@/lib/domain/types";
import { parseSearchParams } from "@/lib/domain/search";

vi.mock("@/app/actions/entries", () => ({ softDeleteEntries: vi.fn(), restoreEntries: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { ToastProvider } from "@/components/ui/Toast";
import { SearchForm } from "./SearchForm";
import { SearchResults } from "./SearchResults";

const e = (i: number, p: Partial<Entry> = {}): Entry => ({
  id: `e${i}`, entry_type: "expense", main_category: "餐飲", sub_category: "午餐", amount: 100 + i, currency: "TWD", entry_date: "2026-10-05",
  notes: `便當${i}`, account_id: "a1", transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});
const names = { a1: "現金", a2: "銀行" };
const show = (entries: Entry[], raw = {}, truncated = false) =>
  render(
    <ToastProvider>
      <SearchResults entries={entries} f={parseSearchParams(raw)} truncated={truncated} accountNames={names} today="2026-10-31" />
    </ToastProvider>,
  );

describe("SearchResults", () => {
  it("says so when nothing matches", () => {
    show([]);
    expect(screen.getByText(/沒有符合的帳目/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("lists one entry per line with date, account and a signed amount, and totals every match", () => {
    show([e(1), e(2, { entry_type: "income", main_category: "薪資", amount: 5000, entry_date: "2025-12-31" }), e(3, { entry_type: "transfer", main_category: "轉帳", account_id: "a1", transfer_account_id: "a2", amount: 900 })]);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4); // header + 3
    expect(within(rows[1]).getByText("10/05")).toBeInTheDocument(); // this year: no year
    expect(within(rows[2]).getByText("25/12/31")).toBeInTheDocument(); // another year: with it
    expect(within(rows[2]).getByText("＋5,000")).toBeInTheDocument();
    expect(within(rows[3]).getByText("現金→銀行")).toBeInTheDocument();
    expect(screen.getByText(/共 3 筆/)).toHaveTextContent("共 3 筆 支出 101 收入 5,000");
    expect(screen.getByRole("button", { name: "選取" })).toBeInTheDocument();
  });

  it("shows 50 per page with links that keep the filters", () => {
    const many = Array.from({ length: 120 }, (_, i) => e(i));
    show(many, { q: "便當", page: "2" });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(51);
    expect(screen.getByText("第 2／3 頁")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "◀ 前一頁" })).toHaveAttribute("href", "/search?q=%E4%BE%BF%E7%95%B6");
    expect(screen.getByRole("link", { name: "下一頁 ▶" })).toHaveAttribute("href", "/search?q=%E4%BE%BF%E7%95%B6&page=3");
  });

  it("a page past the end shows the last page, and a single page has no pager", () => {
    show(Array.from({ length: 60 }, (_, i) => e(i)), { page: "9" });
    expect(screen.getByText("第 2／2 頁")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "下一頁 ▶" })).toBeNull();
  });

  it("says when the read was cut short", () => {
    show([e(1)], {}, true);
    expect(screen.getByText(/超過 3,000 筆/)).toBeInTheDocument();
  });
});

describe("SearchForm", () => {
  const form = (raw = {}) => render(<SearchForm f={parseSearchParams(raw)} expenseMains={["餐飲"]} incomeMains={["薪資"]} />);
  it("is open and plain with no search yet", () => {
    const { container } = form();
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(screen.getByText("搜尋條件")).toBeInTheDocument();
  });
  it("folds to a line naming the criteria once searching, and the fields hold them", () => {
    const { container } = form({ q: "全聯", type: "expense", min: "100" });
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("搜尋條件：「全聯」 支出 100 元以上")).toBeInTheDocument();
    expect(screen.getByLabelText("關鍵字")).toHaveValue("全聯");
    expect(screen.getByLabelText("類型")).toHaveValue("expense");
    expect(screen.getByLabelText("最少金額")).toHaveValue("100");
  });
  it("keeps a category that is no longer offered selectable", () => {
    form({ main: "舊科目" });
    expect(screen.getByLabelText("科目")).toHaveValue("舊科目");
  });
});
