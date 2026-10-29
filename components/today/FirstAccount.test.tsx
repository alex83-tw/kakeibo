import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createAccount = vi.fn();
vi.mock("@/app/actions/accounts", () => ({ createAccount: (...a: unknown[]) => createAccount(...a) }));

import { FirstAccount } from "./FirstAccount";

beforeEach(() => createAccount.mockReset().mockResolvedValue({ ok: true, id: "a1" }));

describe("FirstAccount", () => {
  it("creates a cash account named 現金 dated today with the balance typed", async () => {
    const user = userEvent.setup();
    render(<FirstAccount today="2026-10-29" />);
    await user.type(screen.getByLabelText("餘額"), "3,200");
    await user.click(screen.getByRole("button", { name: "建立帳戶" }));
    expect(createAccount).toHaveBeenCalledWith({ kind: "cash", name: "現金", opening_balance: "3,200", opening_date: "2026-10-29" });
  });
  it("shows the server's complaint under the field and keeps what was typed", async () => {
    createAccount.mockResolvedValue({ ok: false, errors: { opening_balance: "請輸入數字" } });
    const user = userEvent.setup();
    render(<FirstAccount today="2026-10-29" />);
    await user.type(screen.getByLabelText("餘額"), "abc");
    await user.click(screen.getByRole("button", { name: "建立帳戶" }));
    expect(await screen.findByText("請輸入數字")).toBeInTheDocument();
    expect(screen.getByLabelText("餘額")).toHaveProperty("value", "abc");
  });
});
