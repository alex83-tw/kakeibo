import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DaySlider } from "./DaySlider";

const amounts = Array.from({ length: 31 }, (_, i) => (i === 26 ? 450 : i === 27 ? 680 : 100));
const setup = () => render(<DaySlider amounts={amounts} today={28} year={2026} month={10} />);
const slider = () => screen.getByRole("slider");

describe("DaySlider", () => {
  it("starts on today with the month's real length as its range", () => {
    setup();
    expect(slider()).toHaveAttribute("aria-valuenow", "28");
    expect(slider()).toHaveAttribute("aria-valuemin", "1");
    expect(slider()).toHaveAttribute("aria-valuemax", "31");
    expect(slider()).toHaveAttribute("tabindex", "0");
  });
  it("keys: ArrowLeft, Home, End (back to today), PageUp/PageDown clamp", async () => {
    const user = userEvent.setup();
    setup();
    slider().focus();
    await user.keyboard("{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "27");
    await user.keyboard("{Home}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{PageUp}");
    expect(slider()).toHaveAttribute("aria-valuenow", "8");
    await user.keyboard("{End}");
    expect(slider()).toHaveAttribute("aria-valuenow", "28");
    await user.keyboard("{Home}{PageDown}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
  });
  it("shows the selected day's amount", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText("680")).toBeInTheDocument();
    slider().focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(slider().getAttribute("aria-valuetext")).toContain("450");
  });
  it("has no aria-live anywhere", () => {
    const { container } = setup();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });
  it("pointer down at mid-width selects about the 15th–16th", () => {
    setup();
    slider().getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, right: 300, bottom: 72, height: 72, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(slider(), { clientX: 150, pointerId: 1 });
    const v = Number(slider().getAttribute("aria-valuenow"));
    expect(v).toBeGreaterThanOrEqual(15);
    expect(v).toBeLessThanOrEqual(16);
    fireEvent.pointerMove(slider(), { clientX: 0, pointerId: 1, buttons: 1 });
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
  });
  it("is a single tab stop", () => {
    const { container } = setup();
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(1);
  });
});
