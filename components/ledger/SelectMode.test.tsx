import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "@/lib/domain/types";

const softDeleteEntries = vi.fn();
const restoreEntries = vi.fn();
vi.mock("@/app/actions/entries", () => ({
  softDeleteEntries: (...a: unknown[]) => softDeleteEntries(...a),
  restoreEntries: (...a: unknown[]) => restoreEntries(...a),
}));

import { EDIT_EVENT } from "@/components/entry/RecordButton";
import { ToastProvider } from "@/components/ui/Toast";
import { LineButton } from "./LineButton";
import { SelectBar, SelectProvider, useSelect } from "./SelectMode";

const entry = (id: string, p: Partial<Entry> = {}): Entry => ({
  id, entry_type: "expense", main_category: "餐飲", sub_category: "other", amount: 100, currency: "TWD",
  entry_date: "2026-10-05", notes: null, account_id: null, transfer_account_id: null, deleted_at: null, is_recurring: false, ...p,
});

function Start() {
  return <button type="button" onClick={useSelect()!.start}>選取</button>;
}
function Page({ rows }: { rows: Entry[] }) {
  return (
    <ToastProvider>
      <SelectProvider>
        <Start />
        <SelectBar />
        <table>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} hidden={e.notes === "藏起來"}>
                <td>
                  <LineButton entry={e}>{e.id}</LineButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SelectProvider>
    </ToastProvider>
  );
}

beforeEach(() => {
  softDeleteEntries.mockReset();
  restoreEntries.mockReset();
});

describe("選取模式", () => {
  it("outside selecting, a line opens the entry; inside, it marks the line and shows the sum of what is selected", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    window.addEventListener(EDIT_EVENT, onEdit);
    render(<Page rows={[entry("a"), entry("b", { entry_type: "income", amount: 500 }), entry("c", { entry_type: "transfer", amount: 900 })]} />);
    await user.click(screen.getByRole("button", { name: "a" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group", { name: "批次操作" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "選取" }));
    await user.click(screen.getByRole("button", { name: "a" }));
    await user.click(screen.getByRole("button", { name: "b" }));
    await user.click(screen.getByRole("button", { name: "c" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/已選 3 筆/)).toHaveTextContent("已選 3 筆 支出 100 收入 500"); // the transfer is counted as a line, not as money
    await user.click(screen.getByRole("button", { name: "a" }));
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-pressed", "false");
    window.removeEventListener(EDIT_EVENT, onEdit);
  });

  it("全選 takes every line shown and skips rows the filter hid", async () => {
    const user = userEvent.setup();
    render(<Page rows={[entry("a"), entry("b", { notes: "藏起來" }), entry("c")]} />);
    await user.click(screen.getByRole("button", { name: "選取" }));
    await user.click(screen.getByRole("button", { name: "全選" }));
    expect(screen.getByText(/已選 2 筆/)).toBeInTheDocument();
  });

  it("刪除 sends the selected ids, leaves the mode, and 復原 restores exactly what was deleted", async () => {
    const user = userEvent.setup();
    softDeleteEntries.mockResolvedValue({ ok: true, ids: ["a"] }); // b was already gone
    restoreEntries.mockResolvedValue({ ok: true, ids: ["a"] });
    render(<Page rows={[entry("a"), entry("b")]} />);
    await user.click(screen.getByRole("button", { name: "選取" }));
    expect(screen.getByRole("button", { name: "刪除" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "全選" }));
    await user.click(screen.getByRole("button", { name: "刪除" }));
    expect(softDeleteEntries).toHaveBeenCalledWith(["a", "b"]);
    await waitFor(() => expect(screen.queryByRole("group", { name: "批次操作" })).toBeNull());
    expect(screen.getByText("已刪除 1 筆")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "復原" }));
    expect(restoreEntries).toHaveBeenCalledWith(["a"]);
    expect(await screen.findByText("已復原 1 筆")).toBeInTheDocument();
  });

  it("a failed delete keeps the selection and says why", async () => {
    const user = userEvent.setup();
    softDeleteEntries.mockResolvedValue({ ok: false, error: "處理失敗，請稍後再試" });
    render(<Page rows={[entry("a")]} />);
    await user.click(screen.getByRole("button", { name: "選取" }));
    await user.click(screen.getByRole("button", { name: "a" }));
    await user.click(screen.getByRole("button", { name: "刪除" }));
    expect(await screen.findByText("處理失敗，請稍後再試")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "批次操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-pressed", "true");
  });

  it("取消 and Esc leave the mode and forget the selection", async () => {
    const user = userEvent.setup();
    render(<Page rows={[entry("a")]} />);
    await user.click(screen.getByRole("button", { name: "選取" }));
    await user.click(screen.getByRole("button", { name: "a" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "批次操作" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "選取" }));
    expect(screen.getByText(/已選 0 筆/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("group", { name: "批次操作" })).toBeNull();
  });
});
