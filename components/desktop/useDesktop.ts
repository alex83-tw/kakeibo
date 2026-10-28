"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** False on the server and during hydration, so the phone layout is always the first render. */
export function useDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
