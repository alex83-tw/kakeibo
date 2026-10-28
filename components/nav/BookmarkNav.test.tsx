import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));
const desktop = vi.hoisted(() => ({ current: false }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("@/components/desktop/useDesktop", () => ({ useDesktop: () => desktop.current }));

import { BookmarkNav, BOOKMARKS } from "./BookmarkNav";

describe("BookmarkNav", () => {
  beforeEach(() => {
    desktop.current = false;
  });

  it("steps aside on / at desktop width, where the spread carries its own bookmarks, but not on other pages", () => {
    desktop.current = true;
    pathname.current = "/";
    const { container, rerender } = render(<BookmarkNav />);
    expect(container).toBeEmptyDOMElement();
    pathname.current = "/ledger";
    rerender(<BookmarkNav />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("renders the four bookmarks as links", () => {
    pathname.current = "/";
    render(<BookmarkNav />);
    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["今日", "/"],
      ["帳本", "/ledger"],
      ["對帳", "/recon"],
      ["設定", "/settings"],
    ]);
    expect(BOOKMARKS).toHaveLength(4);
  });

  it("marks only the current page", () => {
    pathname.current = "/ledger";
    render(<BookmarkNav />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["帳本"]);
  });

  it("keeps a section highlighted on its sub-pages, but 今日 only on /", () => {
    pathname.current = "/ledger/2026-10-28";
    const { unmount } = render(<BookmarkNav />);
    expect(screen.getByRole("link", { name: "帳本" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "今日" })).not.toHaveAttribute("aria-current");
    unmount();
  });
});
