import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast, type ToastState } from "./Toast";

function Fire({ toasts }: { toasts: ToastState[] }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => toasts.forEach(show)}>
      go
    </button>
  );
}
const undo = (text: string): ToastState => ({ text, action: { label: "復原", run: () => {} } });

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

async function fire(toasts: ToastState[]) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <ToastProvider>
      <Fire toasts={toasts} />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "go" }));
  return user;
}

describe("ToastProvider", () => {
  it("toasts with a 復原 queue one after another instead of replacing each other", async () => {
    await fire([undo("第一筆"), undo("第二筆")]);
    expect(screen.getByText("第一筆")).toBeInTheDocument();
    expect(screen.queryByText("第二筆")).toBeNull();
    act(() => void vi.advanceTimersByTime(8100));
    expect(screen.getByText("第二筆")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(8100));
    expect(screen.queryByText("第二筆")).toBeNull();
  });

  it("a plain message gives way to the next toast at once", async () => {
    await fire([{ text: "已復原" }, { text: "已記錄" }]);
    expect(screen.queryByText("已復原")).toBeNull();
    expect(screen.getByText("已記錄")).toBeInTheDocument();
  });

  it("holds the clock while the pointer is on the toast and resumes with the time left", async () => {
    const user = await fire([undo("慢慢來")]);
    act(() => void vi.advanceTimersByTime(3000));
    await user.hover(screen.getByText("慢慢來"));
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getByText("慢慢來")).toBeInTheDocument();
    await user.unhover(screen.getByText("慢慢來"));
    act(() => void vi.advanceTimersByTime(4900));
    expect(screen.getByText("慢慢來")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.queryByText("慢慢來")).toBeNull();
  });

  it("a toast can ask for longer than the default", async () => {
    await fire([{ ...undo("十秒"), ms: 10000 }]);
    act(() => void vi.advanceTimersByTime(9000));
    expect(screen.getByText("十秒")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1200));
    expect(screen.queryByText("十秒")).toBeNull();
  });
});
