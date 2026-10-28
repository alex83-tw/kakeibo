"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatAmount } from "@/lib/money";
import { toKanji, WEEKDAY_JP } from "@/lib/time";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Dow of a calendar date, independent of the viewer's time zone. */
function weekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Per-day expense bars for a month. One tab stop (role="slider"); pick a day by key or by dragging.
 * Deliberately has no aria-live: dragging would otherwise chatter at screen-reader users.
 */
export function DaySlider({
  amounts,
  today,
  year,
  month,
}: {
  amounts: number[];
  today: number;
  year: number;
  month: number;
}) {
  const days = amounts.length;
  const [day, setDay] = useState(clamp(today, 1, days));
  const max = Math.max(1, ...amounts);
  const amount = amounts[day - 1] ?? 0;
  const label = `${toKanji(day)}日　${WEEKDAY_JP[weekday(year, month, day)]}曜`;

  function onKey(e: KeyboardEvent) {
    const next = {
      ArrowLeft: day - 1,
      ArrowDown: day - 1,
      ArrowRight: day + 1,
      ArrowUp: day + 1,
      Home: 1,
      End: today,
      PageUp: day + 7,
      PageDown: day - 7,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setDay(clamp(next, 1, days));
  }

  function pick(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    setDay(clamp(Math.floor(((e.clientX - r.left) / r.width) * days) + 1, 1, days));
  }

  return (
    <>
      <div className="dayr">
        <span className="l">{label}</span>
        <span>{formatAmount(amount)}</span>
      </div>
      <div
        className="days"
        role="slider"
        tabIndex={0}
        aria-label={`${toKanji(month)}月每日支出，左右滑動或按左右鍵選日`}
        aria-valuemin={1}
        aria-valuemax={days}
        aria-valuenow={day}
        aria-valuetext={`${toKanji(day)}日，支出 NT$${formatAmount(amount)}`}
        style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pick(e);
        }}
      >
        {amounts.map((a, i) => (
          <i
            key={i}
            className={[i + 1 === today ? "t" : "", i + 1 === day ? "sel" : ""].join(" ").trim() || undefined}
            style={{ height: Math.max(3, Math.round((a / max) * 68)) }}
          />
        ))}
      </div>
      <div className="dayscale" aria-hidden="true">
        <span>一日</span>
        <span>{toKanji(Math.ceil(days / 2))}日</span>
        <span>今日 {toKanji(today)}日</span>
      </div>
    </>
  );
}
