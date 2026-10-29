import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setBudget = vi.fn();
const clearBudget = vi.fn();
vi.mock("@/app/actions/budget", () => ({
  setBudget: (...a: unknown[]) => setBudget(...a),
  clearBudget: (...a: unknown[]) => clearBudget(...a),
  copyLastMonthBudget: vi.fn(),
}));

import { BudgetBook, type BudgetBookRow } from "./BudgetBook";

const rows: BudgetBookRow[] = [
  { main: "餐飲", amount: 8000, available: 8000, spent: 3000, thresholdPct: 80 },
  { main: "飲食", amount: null, available: 0, spent: 1500, thresholdPct: 80 },
];
const ui = <BudgetBook year={2026} month={10} rows={rows} addable={["交通"]} hasAny />;

beforeEach(() => {
  setBudget.mockReset().mockResolvedValue({ ok: true });
  clearBudget.mockReset().mockResolvedValue({ ok: true });
});

describe("BudgetBook", () => {
  it("lists spending in unbudgeted categories and totals 已用 across every row", () => {
    render(ui);
    expect(screen.getByLabelText("飲食 預算金額")).toHaveProperty("value", "");
    const total = screen.getByRole("row", { name: /合計/ });
    expect(total.textContent).toContain("8,000");
    expect(total.textContent).toContain("4,500");
  });

  it("saves a changed amount when the field loses focus, with the row's reminder percentage", async () => {
    const user = userEvent.setup();
    render(ui);
    await user.type(screen.getByLabelText("飲食 預算金額"), "2000");
    expect(setBudget).not.toHaveBeenCalled();
    await user.tab();
    await waitFor(() => expect(setBudget).toHaveBeenCalledWith({ main_category: "飲食", year: 2026, month: 10, amount: "2000", warning_threshold: 0.8 }));
    expect(await screen.findByText("飲食：已儲存")).toBeTruthy();
  });

  it("does not save when nothing changed", async () => {
    const user = userEvent.setup();
    render(ui);
    await user.click(screen.getByLabelText("餐飲 預算金額"));
    await user.tab();
    expect(setBudget).not.toHaveBeenCalled();
    expect(clearBudget).not.toHaveBeenCalled();
  });

  it("clearing a budgeted amount cancels that budget", async () => {
    const user = userEvent.setup();
    render(ui);
    await user.clear(screen.getByLabelText("餐飲 預算金額"));
    await user.tab();
    await waitFor(() => expect(clearBudget).toHaveBeenCalledWith({ main_category: "餐飲", year: 2026, month: 10 }));
    expect(await screen.findByText("餐飲：已取消預算")).toBeTruthy();
  });

  it("shows the server's error next to the page and marks the field invalid", async () => {
    setBudget.mockResolvedValue({ ok: false, error: "請輸入數字" });
    const user = userEvent.setup();
    render(ui);
    await user.type(screen.getByLabelText("飲食 預算金額"), "abc");
    await user.tab();
    expect(await screen.findByText("飲食：請輸入數字")).toBeTruthy();
    expect(screen.getByLabelText("飲食 預算金額").getAttribute("aria-invalid")).toBe("true");
  });

  it("adding a category from the list puts a new row on the page and focuses its amount", async () => {
    const user = userEvent.setup();
    render(ui);
    await user.selectOptions(screen.getByLabelText("加入科目"), "交通");
    expect(await screen.findByLabelText("交通 預算金額")).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe("bud-交通-a"));
  });
});
