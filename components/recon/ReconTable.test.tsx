import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
import type { ReconView } from "@/lib/domain/recon";
import { ReconTable } from "./ReconTable";

const view = (rows: ReconView["rows"], totalDiff = 0): ReconView => ({ rows, matchedCount: 0, differingCount: 0, unreconciledCount: 0, totalDiff });
const row = (p: Partial<ReconView["rows"][number]>): ReconView["rows"][number] => ({ id: "a1", name: "現金", kind: "cash", book: 1000, statement: 1000, diff: 0, matched: true, date: "2026-10-28", ...p });

describe("ReconTable", () => {
  it("one row per account: book, actual, difference and date", () => {
    render(<ReconTable recon={view([row({}), row({ id: "a2", name: "銀行", book: 5000, statement: 4900, diff: -100, matched: false, date: "2026-10-05" }), row({ id: "a3", name: "卡", statement: null, diff: null, matched: null, date: null })], -100)} />);
    const bank = within(screen.getByRole("row", { name: /銀行/ })).getAllByRole("cell").map((c) => c.textContent);
    expect(bank[0]).toContain("5,000");
    expect(bank[1]).toContain("4,900");
    expect(bank[2]).toMatch(/100/);
    expect(bank[3]).toBe("10/5");
    expect(within(screen.getByRole("row", { name: /現金/ })).getByText("對上")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /卡/ })).getByText("未對帳")).toBeTruthy();
  });

  it("links an account name to the input form with that account chosen, only when asked", () => {
    const { rerender } = render(<ReconTable recon={view([row({})])} linkAccounts />);
    expect(screen.getByRole("link", { name: /現金/ }).getAttribute("href")).toBe("/recon?a=a1#recon-form");
    rerender(<ReconTable recon={view([row({})])} />);
    expect(screen.queryByRole("link", { name: /現金/ })).toBeNull();
  });

  it("with no accounts still draws the ledger and says where to start", () => {
    render(<ReconTable recon={view([])} />);
    expect(screen.getByRole("columnheader", { name: "差額" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "先到設定建立" }).getAttribute("href")).toBe("/settings/accounts");
  });
});
