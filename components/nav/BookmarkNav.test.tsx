import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { BookmarkNav, BOOKMARKS } from "./BookmarkNav";

describe("BookmarkNav", () => {
  it("renders 今日／帳本／預算／設定 as real links, 帳本 marked for the left page", () => {
    pathname.current = "/";
    render(<BookmarkNav />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["今日", "/"],
      ["帳本", "/ledger"],
      ["預算", "/budget"],
      ["設定", "/settings"],
    ]);
    expect(links[1]).toHaveClass("tab-l");
    expect(BOOKMARKS).toHaveLength(4);
  });

  it("marks only the current page", () => {
    pathname.current = "/budget";
    render(<BookmarkNav />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["預算"]);
  });

  it("keeps a section highlighted on its sub-pages, but 今日 only on /", () => {
    pathname.current = "/settings/accounts";
    render(<BookmarkNav />);
    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "今日" })).not.toHaveAttribute("aria-current");
  });
});
