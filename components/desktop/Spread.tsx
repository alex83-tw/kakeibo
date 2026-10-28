"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "./useDesktop";

const LEFT = [{ id: "p-ledger", label: "帳本" }] as const;
const RIGHT = [
  { id: "p-today", label: "今日" },
  { id: "p-budget", label: "預算" },
  { id: "p-recon", label: "對帳" },
] as const;

/**
 * 電腦版見開き。≥ 1024px 渲染左右兩頁與書籤；其餘寬度只渲染 children（手機版）。
 * 兩種版面是同一份資料的不同渲染，不是 CSS 隱藏，所以手機的 Tab 順序裡沒有桌面專用的連結。
 */
export function Spread({ left, right, children }: { left: ReactNode; right: ReactNode; children: ReactNode }) {
  const desktop = useDesktop();
  return desktop ? <Pages left={left} right={right} /> : children;
}

function Pages({ left, right }: { left: ReactNode; right: ReactNode }) {
  // Pages only mounts after useDesktop() turned true on the client, so window is available here.
  const [active, setActive] = useState<string>(
    () => [...LEFT, ...RIGHT].find((b) => `#${b.id}` === window.location.hash)?.id ?? LEFT[0].id,
  );
  // A bookmark click scrolls the page; ignore the scroll events that follow it so the clicked tab stays active.
  const lockedUntil = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockedUntil.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      // The right page's sections run top to bottom: the last one that has reached the upper third is being read.
      const reading = RIGHT.filter((b) => (document.getElementById(b.id)?.getBoundingClientRect().top ?? Infinity) <= window.innerHeight * 0.35);
      const next = atBottom ? RIGHT[RIGHT.length - 1] : reading[reading.length - 1];
      if (next) setActive(next.id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tab = (b: { id: string; label: string }) => (
    <a key={b.id} className="tab" href={`#${b.id}`} aria-current={active === b.id ? "location" : undefined} onClick={() => {
        lockedUntil.current = Date.now() + 900;
        setActive(b.id);
      }}>
      <span>{b.label}</span>
    </a>
  );

  return (
    <div className="spread">
      <nav className="sp-tabs" aria-label="頁面">
        <div className="sp-tabs-l">{LEFT.map(tab)}</div>
        <div className="sp-tabs-r">
          {RIGHT.map(tab)}
          <Link className="sp-set" href="/settings">
            設定
          </Link>
        </div>
      </nav>
      <div className="sp-pages">
        <div className="sp-page sp-l" id="p-ledger">
          {left}
        </div>
        <div className="sp-page sp-r">{right}</div>
      </div>
    </div>
  );
}
