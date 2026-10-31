import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
import type { Alert } from "@/lib/domain/alerts";
import { AlertList } from "./AlertList";

const alert = (kind: Alert["kind"], subject: string): Alert => ({ kind, subject, body: "x", text: subject, href: "/settings/budget", actionLabel: "看預算" });

describe("AlertList tags", () => {
  it("only an overrun or a reconcile difference is 需處理; every other kind wears its own tag", () => {
    const kinds: Alert["kind"][] = ["budget-over", "budget-warning", "budget-projected", "reconcile", "uncategorized", "duplicate", "abnormal", "missing-recurring"];
    render(<AlertList alerts={kinds.map((k) => alert(k, k))} />);
    const tag = (name: string) => screen.getByText(name).closest(".alert")?.querySelector(".tag")?.textContent;
    expect(kinds.map(tag)).toEqual(["需處理", "接近預算", "預估超支", "需處理", "待分類", "疑似重複", "金額異常", "漏記"]);
  });
  it("an alert with a preset opens the entry form instead of linking", () => {
    render(<AlertList alerts={[{ ...alert("missing-recurring", "房租"), actionLabel: "去記帳", preset: { main: "居住", sub: "房租", notes: "房租" } }]} />);
    expect(screen.getByRole("button", { name: "去記帳" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去記帳" })).toBeNull();
  });
});

describe("AlertList month-end row", () => {
  it("adds a 月結 row after the alerts, and an empty list does not claim there is nothing to do", () => {
    render(<AlertList alerts={[]} monthCloseDue month={10} />);
    expect(screen.queryByText("目前沒有需要處理的事。")).toBeNull();
    expect(screen.getByText("月結").closest(".alert")?.querySelector(".tag")?.textContent).toBe("月結");
    expect(screen.getByRole("link", { name: "去月結" })).toHaveAttribute("href", "/close");
  });
  it("is absent before the last week", () => {
    render(<AlertList alerts={[]} />);
    expect(screen.getByText("目前沒有需要處理的事。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去月結" })).toBeNull();
  });
});
