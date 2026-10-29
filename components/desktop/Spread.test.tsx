import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const desktop = vi.hoisted(() => ({ current: false }));
vi.mock("./useDesktop", () => ({ useDesktop: () => desktop.current }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import { Spread } from "./Spread";

const ui = (
  <Spread left={<p>左頁</p>} right={<p>右頁</p>}>
    <p>手機版</p>
  </Spread>
);

describe("Spread", () => {
  beforeEach(() => {
    desktop.current = false;
  });

  it("below the breakpoint renders only the phone version: no spread, no desktop-only links", () => {
    const { container } = render(ui);
    expect(screen.getByText("手機版")).toBeTruthy();
    expect(screen.queryByText("左頁")).toBeNull();
    expect(screen.queryByText("右頁")).toBeNull();
    expect(container.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("at desktop width renders both pages and the bookmarks, and not the phone version", () => {
    desktop.current = true;
    render(ui);
    expect(screen.getByText("左頁")).toBeTruthy();
    expect(screen.getByText("右頁")).toBeTruthy();
    expect(screen.queryByText("手機版")).toBeNull();
    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["帳本", "#p-ledger"],
      ["今日", "#p-today"],
      ["預算", "#p-budget"],
      ["對帳", "#p-recon"],
      ["設定", "/settings"],
    ]);
  });

  it("opens on 今日 (the home page) when there is no hash", () => {
    desktop.current = true;
    render(ui);
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "location").map((a) => a.textContent)).toEqual(["今日"]);
  });

  it("marks the bookmark for the hash it opened on", () => {
    desktop.current = true;
    window.location.hash = "#p-budget";
    render(ui);
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "location").map((a) => a.textContent)).toEqual(["預算"]);
    window.location.hash = "";
  });
});
