import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/domain/types";
import { ReportView } from "./ReportView";

const e = (entry_date: string, entry_type: Entry["entry_type"], amount: number, main_category = "餐飲"): Entry => ({
  id: `${entry_date}${amount}${main_category}`, entry_type, main_category, sub_category: "other", amount, currency: "TWD", entry_date, notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false,
});
const entries = [e("2026-09-10", "expense", 1000), e("2026-10-01", "income", 5000, "薪資"), e("2026-10-02", "expense", 1500), e("2026-10-03", "expense", 500, "交通")];
const now = { year: 2026, month: 10 };

describe("ReportView", () => {
  it("month view: totals, change against last month, categories linked to their entries, a heat calendar day linked to its day", () => {
    render(<ReportView period={{ kind: "month", year: 2026, month: 10 }} entries={entries} thisMonth={now} />);
    expect(screen.getByText("比上個月 ＋100%")).toBeInTheDocument(); // 1,000 → 2,000
    const cat = screen.getByRole("table", { name: /支出依科目/ });
    expect(within(cat).getByRole("link", { name: "餐飲" })).toHaveAttribute("href", "/search?type=expense&main=%E9%A4%90%E9%A3%B2&from=2026-10-01&to=2026-10-31");
    expect(within(cat).getByText("75%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /10月2日 支出 1,500/ })).toHaveAttribute("href", "/search?type=expense&from=2026-10-02&to=2026-10-02");
    expect(screen.getByRole("link", { name: "年" })).toHaveAttribute("href", "/reports?y=2026");
  });

  it("year view has no calendar and steps by year", () => {
    render(<ReportView period={{ kind: "year", year: 2026 }} entries={entries} thisMonth={now} />);
    expect(screen.queryByText("每日支出")).toBeNull();
    expect(screen.getByRole("link", { name: /前一年/ })).toHaveAttribute("href", "/reports?y=2025");
    expect(screen.getByRole("link", { name: "月" })).toHaveAttribute("href", "/reports?m=2026-10");
  });

  it("says so when the period has no entries", () => {
    render(<ReportView period={{ kind: "month", year: 2020, month: 1 }} entries={[]} thisMonth={now} />);
    expect(screen.getByText("這段期間還沒有帳目。")).toBeInTheDocument();
  });
});
