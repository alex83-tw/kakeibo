import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createRecurring = vi.fn();
vi.mock("@/app/actions/recurring", () => ({ createRecurring: (...a: unknown[]) => createRecurring(...a) }));

import { RecurringSuggestions } from "./RecurringSuggestions";

const s = { label: "Netflix", entry_type: "expense" as const, main: "娛樂休閒", sub: "訂閱服務", min: 330, max: 390, day: 12, months: 3, last: "2026-10-12" };

beforeEach(() => createRecurring.mockReset());

describe("RecurringSuggestions", () => {
  it("renders nothing without suggestions", () => {
    const { container } = render(<RecurringSuggestions suggestions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("加入 makes a monthly rule from the suggestion and marks it added", async () => {
    createRecurring.mockResolvedValue({ ok: true });
    render(<RecurringSuggestions suggestions={[s]} />);
    expect(screen.getByText(/330～390/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /加入/ }));
    expect(createRecurring).toHaveBeenCalledWith({ label: "Netflix", entry_type: "expense", main_category: "娛樂休閒", sub_category: "訂閱服務", amount_min: "330", amount_max: "390", due_day: "12", frequency: "monthly" });
    expect(await screen.findByText("已加入")).toBeInTheDocument();
  });
  it("shows why a rule could not be made and keeps the button", async () => {
    createRecurring.mockResolvedValue({ ok: false, errors: { form: "儲存失敗，請稍後再試" } });
    render(<RecurringSuggestions suggestions={[s]} />);
    await userEvent.click(screen.getByRole("button", { name: /加入/ }));
    expect(await screen.findByText("儲存失敗，請稍後再試")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /加入/ })).toBeInTheDocument();
  });
});
