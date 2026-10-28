import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveReconciliation = vi.fn();
vi.mock("@/app/actions/recon", () => ({ saveReconciliation: (...a: unknown[]) => saveReconciliation(...a) }));

import { ReconcileForm } from "./ReconcileForm";

const card = [{ id: "card", name: "信用卡", kind: "credit_card" as const, book: -3150 }];

beforeEach(() => {
  saveReconciliation.mockReset().mockImplementation(async (i: { statement: string }) => {
    const statement = Number(i.statement.replace(/[,\s]/g, "").replace("△", "-"));
    const diff = -3150 - statement;
    return { ok: true, diff, matched: diff === 0 };
  });
});

async function submit(text: string) {
  const user = userEvent.setup();
  render(<ReconcileForm accounts={card} />);
  if (text) await user.type(screen.getByLabelText(/帳單/), text);
  await user.click(screen.getByRole("button", { name: "對帳" }));
}

describe("ReconcileForm", () => {
  it("a credit card statement of △2,830 against a book of △3,150 owes 320 more", async () => {
    await submit("△2,830");
    expect(await screen.findByText("帳面比帳單多欠 320")).toBeInTheDocument();
    expect(screen.getByText("△320")).toBeInTheDocument();
    expect(screen.getByText(/可能多記或退款未記/)).toBeInTheDocument();
    expect(saveReconciliation).toHaveBeenCalledWith(expect.objectContaining({ account_id: "card", statement: "△2,830" }));
  });
  it("△3,150 matches", async () => {
    await submit("△3,150");
    expect(await screen.findByText("對上")).toBeInTheDocument();
  });
  it.each(["abc", ""])("rejects %j without saving", async (text) => {
    await submit(text);
    expect(screen.getByText("請輸入數字")).toBeInTheDocument();
    expect(saveReconciliation).not.toHaveBeenCalled();
  });
  it("announces results politely", async () => {
    await submit("△2,830");
    await screen.findByText("帳面比帳單多欠 320");
    expect(document.querySelector("[aria-live=polite]")).toContainElement(screen.getByText("帳面比帳單多欠 320"));
  });
  it("shows the server's error", async () => {
    saveReconciliation.mockResolvedValue({ ok: false, error: "儲存失敗，請稍後再試" });
    await submit("100");
    expect(await screen.findByText("儲存失敗，請稍後再試")).toBeInTheDocument();
  });
  it("lets you pick the account when there are several", async () => {
    const user = userEvent.setup();
    render(<ReconcileForm accounts={[...card, { id: "cash", name: "現金", kind: "cash", book: 8200 }]} />);
    await user.selectOptions(screen.getByLabelText("帳戶"), "cash");
    await user.type(screen.getByLabelText(/帳單/), "8,000");
    await user.click(screen.getByRole("button", { name: "對帳" }));
    expect(saveReconciliation).toHaveBeenCalledWith(expect.objectContaining({ account_id: "cash" }));
  });
});
