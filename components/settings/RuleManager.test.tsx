import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createRule = vi.fn();
const removeRule = vi.fn();
vi.mock("@/app/actions/rules", () => ({ createRule: (...a: unknown[]) => createRule(...a), removeRule: (...a: unknown[]) => removeRule(...a) }));

import { ToastProvider } from "@/components/ui/Toast";
import { RuleManager } from "./RuleManager";

const item = { id: "r1", keyword: "全聯", category: "日用購物／一般", rule: { entry_type: "expense" as const, main_category: "日用購物", sub_category: "other" } };

beforeEach(() => {
  createRule.mockReset().mockResolvedValue({ ok: true });
  removeRule.mockReset().mockResolvedValue({ ok: true });
});

describe("RuleManager delete", () => {
  it("offers 復原 after deleting, and 復原 puts the same rule back", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <RuleManager items={[item]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /刪除/ }));
    expect(removeRule).toHaveBeenCalledWith("r1");
    await user.click(await screen.findByRole("button", { name: "復原" }));
    expect(createRule).toHaveBeenCalledWith({ keyword: "全聯", entry_type: "expense", main_category: "日用購物", sub_category: "other" });
    expect(await screen.findByText("已復原")).toBeInTheDocument();
  });
});
