import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchRow } from "@/app/actions/batch-import";

const previewBatch = vi.fn();
const applyBatch = vi.fn();
const softDeleteEntries = vi.fn();
const createRule = vi.fn();
vi.mock("@/app/actions/batch-import", () => ({ previewBatch: (...a: unknown[]) => previewBatch(...a), applyBatch: (...a: unknown[]) => applyBatch(...a) }));
vi.mock("@/app/actions/entries", () => ({ softDeleteEntries: (...a: unknown[]) => softDeleteEntries(...a) }));
vi.mock("@/app/actions/rules", () => ({ createRule: (...a: unknown[]) => createRule(...a) }));

import { ToastProvider } from "@/components/ui/Toast";
import { BatchImport } from "./BatchImport";

const accounts = [{ id: "cash", name: "現金", kind: "cash" }, { id: "card", name: "玉山信用卡", kind: "credit_card" }];
const r = (p: Partial<BatchRow> = {}): BatchRow => ({ line: 2, date: "2026-10-31", time: "13:39", merchant: "星巴克", amount: 155, entry_type: "expense", main: "餐飲", sub: "咖啡", duplicate: false, ...p });
const rows = [r(), r({ line: 3, merchant: "UBER", amount: 634, main: "其他", sub: "other", duplicate: true }), r({ line: 4, merchant: "優步退款", amount: 619, entry_type: "income", main: "其他", sub: "退款" })];

async function parsed() {
  const user = userEvent.setup();
  previewBatch.mockResolvedValue({ ok: true, rows, errors: [] });
  render(
    <ToastProvider>
      <BatchImport accounts={accounts} />
    </ToastProvider>,
  );
  await user.type(screen.getByLabelText("明細"), "x");
  await user.click(screen.getByRole("button", { name: "解析" }));
  await screen.findByRole("heading", { name: "確認" });
  return user;
}

beforeEach(() => {
  previewBatch.mockReset();
  applyBatch.mockReset();
  softDeleteEntries.mockReset();
  createRule.mockReset();
});

describe("BatchImport", () => {
  it("shows what was read: the account defaults to the credit card, a duplicate starts unticked and says so", async () => {
    await parsed();
    expect(screen.getByLabelText("帳戶")).toHaveValue("card");
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, false, true]);
    expect(screen.getByText("已在帳本")).toBeInTheDocument();
    expect(screen.getByText("＋619")).toBeInTheDocument(); // the refund
    expect(screen.getByRole("button", { name: "匯入 2 筆" })).toBeEnabled();
  });

  it("sends the ticked rows with the account, the user's edits, and the duplicate flag", async () => {
    const user = await parsed();
    applyBatch.mockResolvedValue({ ok: true, ids: ["n1", "n2", "n3"], skipped: 0 });
    await user.click(screen.getAllByRole("checkbox")[1]); // keep the duplicate
    await user.selectOptions(screen.getAllByRole("combobox", { name: /^科目/ })[1], "expense::交通::捷運");
    await user.clear(screen.getByLabelText("摘要 2026-10-31", { selector: "input[value='星巴克']" }));
    await user.click(screen.getByRole("button", { name: "匯入 3 筆" }));
    const [account, sent] = applyBatch.mock.calls[0];
    expect(account).toBe("card");
    expect(sent).toHaveLength(3);
    expect(sent[0]).toMatchObject({ merchant: "", keepDuplicate: false });
    expect(sent[1]).toMatchObject({ merchant: "UBER", main: "交通", sub: "捷運", keepDuplicate: true });
    expect(sent[2]).toMatchObject({ entry_type: "income", main: "其他", sub: "退款" });
    expect(await screen.findByText("已匯入 3 筆")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "確認" })).toBeNull();
  });

  it("復原 soft-deletes exactly the imported ids", async () => {
    const user = await parsed();
    applyBatch.mockResolvedValue({ ok: true, ids: ["n1", "n3"], skipped: 0 });
    softDeleteEntries.mockResolvedValue({ ok: true, ids: ["n1", "n3"] });
    await user.click(screen.getByRole("button", { name: "匯入 2 筆" }));
    await user.click(await screen.findByRole("button", { name: "復原" }));
    expect(softDeleteEntries).toHaveBeenCalledWith(["n1", "n3"]);
    expect(await screen.findByText("已復原 2 筆")).toBeInTheDocument();
  });

  it("keeps the table and shows the server's reason when the import is refused", async () => {
    const user = await parsed();
    applyBatch.mockResolvedValue({ ok: false, error: "第 3 行：日期不正確" });
    await user.click(screen.getByRole("button", { name: "匯入 2 筆" }));
    expect(await screen.findByText("第 3 行：日期不正確")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "確認" })).toBeInTheDocument();
  });

  it("save as rule asks for the keyword (defaults to the merchant) and creates an expense rule from the row's category", async () => {
    const user = await parsed();
    createRule.mockResolvedValue({ ok: true });
    await user.click(screen.getByRole("button", { name: /存為規則：星巴克/ }));
    const kw = screen.getByLabelText("規則的關鍵字");
    expect(kw).toHaveValue("星巴克");
    await user.clear(kw);
    await user.type(kw, "星巴");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(createRule).toHaveBeenCalledWith({ keyword: "星巴", entry_type: "expense", main_category: "餐飲", sub_category: "咖啡" });
    await waitFor(() => expect(screen.queryByLabelText("規則的關鍵字")).toBeNull());
    expect(screen.getByRole("button", { name: "匯入 2 筆" })).toBeInTheDocument(); // the rows are untouched
  });

  it("a refund and a row with no merchant offer no 存為規則", async () => {
    await parsed();
    expect(screen.getAllByRole("button", { name: /^存為規則/ })).toHaveLength(2); // 星巴克 and UBER, not the refund
  });

  it("says when nothing was read, and lists the bad lines", async () => {
    const user = userEvent.setup();
    previewBatch.mockResolvedValue({ ok: true, rows: [], errors: [{ line: 1, message: "第一欄要是日期" }] });
    render(
      <ToastProvider>
        <BatchImport accounts={accounts} />
      </ToastProvider>,
    );
    await user.type(screen.getByLabelText("明細"), "hello");
    await user.click(screen.getByRole("button", { name: "解析" }));
    expect(await screen.findByText(/第 1 行：第一欄要是日期/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "確認" })).toBeNull();
  });

  it("解析 is off until something is pasted", () => {
    render(
      <ToastProvider>
        <BatchImport accounts={[]} />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "解析" })).toBeDisabled();
  });
});
