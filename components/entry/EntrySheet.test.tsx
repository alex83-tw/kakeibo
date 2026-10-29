import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LedgerAccount } from "@/lib/domain/types";

const createEntry = vi.fn();
const softDeleteEntry = vi.fn();
const updateEntry = vi.fn();
vi.mock("@/app/actions/entries", () => ({
  updateEntry: (...a: unknown[]) => updateEntry(...a),
  previewRate: async () => 0.21,
  restoreEntry: vi.fn(),
  createEntry: (...a: unknown[]) => createEntry(...a),
  softDeleteEntry: (...a: unknown[]) => softDeleteEntry(...a),
}));

import { ToastProvider } from "@/components/ui/Toast";
import { EntrySheet as Sheet } from "./EntrySheet";
import { CategoryOptionsProvider } from "./CategoryOptions";
import { EDIT_EVENT, RECORD_EVENT } from "./RecordButton";

const EntrySheet = (props: React.ComponentProps<typeof Sheet>) => (
  <ToastProvider>
    <Sheet {...props} />
  </ToastProvider>
);

const acct = (id: string, name: string, kind: LedgerAccount["kind"], sort_order: number): LedgerAccount => ({
  id, name, kind, sort_order, opening_balance: 0, opening_date: "2026-01-01", archived: false,
});
const accounts = [acct("a1", "現金", "cash", 0), acct("a2", "銀行", "bank", 1)];

async function open() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<EntrySheet accounts={accounts} recentCategories={[{ main: "餐飲", sub: "午餐" }]} />);
  await user.click(screen.getByRole("button", { name: "記一筆" }));
  return user;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  createEntry.mockReset().mockResolvedValue({ ok: true, id: "new1" });
  softDeleteEntry.mockReset().mockResolvedValue({ ok: true, id: "new1" });
  updateEntry.mockReset().mockResolvedValue({ ok: true, id: "e1" });
});
afterEach(() => vi.useRealTimers());

describe("EntrySheet category options", () => {
  it("offers a renamed category from the provider, not only the built-in taxonomy", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <CategoryOptionsProvider value={{ expense: { 吃喝: ["午餐"], 交通: [] }, income: { 薪資: [] } }}>
        <EntrySheet accounts={accounts} recentCategories={[]} />
      </CategoryOptionsProvider>,
    );
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    const options = within(screen.getByLabelText("科目")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("吃喝／午餐");
    expect(options).toContain("吃喝／一般");
    await user.click(screen.getByRole("radio", { name: "收入" }));
    expect(within(screen.getByLabelText("科目")).getAllByRole("option").map((o) => o.textContent)).toContain("薪資／一般");
  });
});

describe("EntrySheet from an alert", () => {
  it("opens with the rule's category and note filled in when a record event arrives", async () => {
    render(<EntrySheet accounts={accounts} recentCategories={[{ main: "餐飲", sub: "午餐" }]} />);
    act(() => {
      window.dispatchEvent(new CustomEvent(RECORD_EVENT, { detail: { main: "居住", sub: "房租", notes: "房租" } }));
    });
    expect((await screen.findByLabelText("科目")) as HTMLSelectElement).toHaveProperty("value", "居住::房租");
    expect(screen.getByLabelText("摘要")).toHaveProperty("value", "房租");
  });

  it("lists a recently used category once, not again under its main category", async () => {
    await open();
    const labels = within(screen.getByLabelText("科目")).getAllByRole("option").map((o) => o.textContent);
    expect(labels.filter((l) => l === "餐飲／午餐")).toHaveLength(1);
  });

  it("the plain 記一筆 button starts blank after an alert opened it with a preset", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntrySheet accounts={accounts} recentCategories={[]} />);
    act(() => {
      window.dispatchEvent(new CustomEvent(RECORD_EVENT, { detail: { main: "居住", sub: "房租", notes: "房租" } }));
    });
    await user.click(await screen.findByRole("button", { name: "取消" }));
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    expect(screen.getByLabelText("摘要")).toHaveProperty("value", "");
  });
});

describe("EntrySheet states where the entry will be filed", () => {
  it("spells out the default category above 儲存, follows the select, and is absent for transfers", async () => {
    const user = await open();
    expect(screen.getByRole("button", { name: "餐飲／午餐" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("科目"), "交通::other");
    expect(screen.getByRole("button", { name: "交通／一般" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "轉帳" }));
    expect(screen.queryByText(/^記為/)).toBeNull();
  });
  it("says so when no category is chosen yet (income starts blank)", async () => {
    const user = await open();
    await user.click(screen.getByRole("radio", { name: "收入" }));
    expect(screen.getByRole("button", { name: "（尚未選科目）" })).toBeInTheDocument();
  });
});

describe("EntrySheet 自動分類 rules", () => {
  const rules = [{ id: "r1", keyword: "全聯", entry_type: "expense" as const, main_category: "日用購物", sub_category: "other" }];
  const openWithRules = async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntrySheet accounts={accounts} recentCategories={[{ main: "餐飲", sub: "午餐" }]} rules={rules} />);
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    return user;
  };
  it("typing a rule's keyword in the notes picks its category", async () => {
    const user = await openWithRules();
    await user.type(screen.getByLabelText("摘要"), "全聯 汐止");
    expect(screen.getByLabelText("科目")).toHaveProperty("value", "日用購物::other");
  });
  it("a category the user picked is never overridden by a rule", async () => {
    const user = await openWithRules();
    await user.selectOptions(screen.getByLabelText("科目"), "交通::other");
    await user.type(screen.getByLabelText("摘要"), "全聯");
    expect(screen.getByLabelText("科目")).toHaveProperty("value", "交通::other");
  });
});

describe("EntrySheet transfer without enough accounts", () => {
  it("explains what is missing and does not offer a save", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntrySheet accounts={[]} recentCategories={[]} />);
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    await user.click(screen.getByRole("radio", { name: "轉帳" }));
    expect(screen.getByText(/請先到「設定 → 帳戶」建立至少兩個帳戶/)).toBeInTheDocument();
    expect(screen.queryByLabelText("轉出")).toBeNull();
    expect(screen.getByRole("button", { name: "儲存" })).toBeDisabled();
  });
});

describe("EntrySheet as a modal dialog", () => {
  it("is aria-modal, and the book behind it (bookmarks, both pages) is inert only while it is open", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <div className="book" data-testid="book">
        <nav className="tabs" />
        <EntrySheet accounts={accounts} recentCategories={[]} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("book")).toHaveAttribute("inert");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("book")).not.toHaveAttribute("inert");
  });
});

describe("EntrySheet editing a ledger line", () => {
  const entry = {
    id: "e1", entry_type: "expense" as const, main_category: "餐飲", sub_category: "午餐", amount: 120, currency: "TWD",
    entry_date: "2026-10-05", notes: "便當", account_id: "a1", transfer_account_id: null, deleted_at: null, is_recurring: false,
  };

  it("opens the entry from the edit event, and 刪除這筆 soft-deletes it with a 復原", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntrySheet accounts={accounts} recentCategories={[]} />);
    act(() => {
      window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: entry }));
    });
    expect(screen.getByRole("dialog", { name: "編輯帳目" })).toBeInTheDocument();
    expect(screen.getByLabelText("摘要")).toHaveValue("便當");
    await user.click(screen.getByRole("button", { name: "刪除這筆" }));
    expect(softDeleteEntry).toHaveBeenCalledWith("e1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("已刪除一筆帳目");
    expect(screen.getByRole("button", { name: "復原" })).toBeInTheDocument();
  });

  it("a foreign-currency entry edits what is stored (JPY), previews the TWD, and saves with its currency", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntrySheet accounts={accounts} recentCategories={[]} />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(EDIT_EVENT, { detail: { ...entry, currency: "TWD", amount: 252, foreign: { currency: "JPY", amount: 1200, rate: 0.21 } } }),
      );
    });
    expect(screen.getByRole("dialog", { name: "編輯帳目" })).toBeInTheDocument();
    expect(screen.getByLabelText("幣別")).toHaveValue("JPY");
    expect(screen.getByLabelText("金額")).toHaveValue("1200");
    expect(await screen.findByText(/≈ NT\$252/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("金額"));
    await user.type(screen.getByLabelText("金額"), "2000");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(updateEntry).toHaveBeenCalledWith("e1", expect.objectContaining({ currency: "JPY", amount: "2000" }));
  });

  it("a transfer is always in TWD", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntrySheet accounts={accounts} recentCategories={[]} />);
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    await user.selectOptions(screen.getByLabelText("幣別"), "USD");
    await user.click(screen.getByRole("radio", { name: "轉帳" }));
    expect(screen.getByLabelText("幣別")).toHaveValue("TWD");
    expect(screen.getByLabelText("幣別")).toBeDisabled();
  });
});

describe("EntrySheet", () => {
  it("opens on expense with the amount field focused", async () => {
    await open();
    expect(screen.getByRole("radio", { name: "支出" })).toBeChecked();
    expect(screen.getByLabelText("金額")).toHaveFocus();
  });

  it("an empty amount keeps the sheet open, shows the error, refocuses the field and saves nothing", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("請輸入金額")).toBeInTheDocument();
    expect(screen.getByLabelText("金額")).toHaveFocus();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it("rejects non-numeric input, then saves '1,500' as typed", async () => {
    const user = await open();
    await user.type(screen.getByLabelText("金額"), "abc");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(screen.getByText("請輸入數字")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("金額"));
    await user.type(screen.getByLabelText("金額"), "1,500");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(createEntry.mock.calls[0][0]).toMatchObject({ amount: "1,500", entry_type: "expense", main_category: "餐飲", sub_category: "午餐", account_id: "a1" });
  });

  it("transfer hides the category and explains itself; switching back restores it", async () => {
    const user = await open();
    expect(screen.getByLabelText("科目")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "轉帳" }));
    expect(screen.queryByLabelText("科目")).not.toBeInTheDocument();
    expect(screen.getByLabelText("轉出")).toBeInTheDocument();
    expect(screen.getByLabelText("轉入")).toBeInTheDocument();
    expect(screen.getByText("轉帳只移動餘額，不計入收入與支出")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "支出" }));
    expect(screen.getByLabelText("科目")).toBeInTheDocument();
  });

  it("transfer to the same account is rejected", async () => {
    const user = await open();
    await user.click(screen.getByRole("radio", { name: "轉帳" }));
    await user.type(screen.getByLabelText("金額"), "100");
    await user.selectOptions(screen.getByLabelText("轉入"), "a1");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(screen.getByText("轉出與轉入不能是同一個帳戶")).toBeInTheDocument();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it("arrow keys move the type selection", async () => {
    const user = await open();
    screen.getByRole("radio", { name: "支出" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "收入" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "收入" })).toHaveFocus();
  });

  it("after saving: sheet closes, toast offers 復原, 復原 soft-deletes, toast fades after ~5s", async () => {
    const user = await open();
    await user.type(screen.getByLabelText("金額"), "1,500");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const toast = screen.getByRole("status");
    expect(within(toast).getByText("已記錄 NT$1,500 支出")).toBeInTheDocument();
    await user.click(within(toast).getByRole("button", { name: "復原" }));
    expect(softDeleteEntry).toHaveBeenCalledWith("new1");

    // a second save to test the timeout path
    await user.click(screen.getByRole("button", { name: "記一筆" }));
    await user.type(screen.getByLabelText("金額"), "20");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() => expect(screen.getByText("已記錄 NT$20 支出")).toBeInTheDocument());
    act(() => { vi.advanceTimersByTime(5200); });
    expect(screen.queryByText("已記錄 NT$20 支出")).not.toBeInTheDocument();
  });

  it("a server error keeps the sheet open and shows the message", async () => {
    createEntry.mockResolvedValue({ ok: false, errors: { form: "儲存失敗，請稍後再試" } });
    const user = await open();
    await user.type(screen.getByLabelText("金額"), "10");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(await screen.findByText("儲存失敗，請稍後再試")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Esc closes the sheet and returns focus to the trigger", async () => {
    const user = await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "記一筆" })).toHaveFocus();
  });
});
