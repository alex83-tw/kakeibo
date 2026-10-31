"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastState {
  text: string;
  action?: { label: string; run: () => void };
  /** How long it stays, overriding the provider's default. */
  ms?: number;
}

interface ToastApi {
  /** Show a toast. A plain message on screen (已復原, an error) gives way at once; one carrying an action (復原) keeps its time, and this one waits behind it. */
  show: (t: ToastState) => void;
  /** Dismiss the toast on screen (the next one, if any, takes its place). */
  clear: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a ToastProvider");
  return api;
}

/**
 * One toast on screen at a time, the rest queue behind it. Each lasts `ms`, and the clock stops while the pointer or focus is on it,
 * so 復原 can be reached by a slow hand or a keyboard.
 */
export function ToastProvider({ children, ms = 5000 }: { children: ReactNode; ms?: number }) {
  const [queue, setQueue] = useState<ToastState[]>([]);
  // Held per toast: a toast dismissed under the pointer never fires pointerleave, so a flag shared by all toasts would stay stuck.
  const [heldFor, setHeldFor] = useState<ToastState | null>(null);
  const left = useRef(new WeakMap<ToastState, number>());
  const head = queue[0];
  const paused = head !== undefined && heldFor === head;

  useEffect(() => {
    if (!head || paused) return;
    const budget = left.current;
    const rest = budget.get(head) ?? head.ms ?? ms;
    const started = Date.now();
    const t = setTimeout(() => setQueue((q) => q.slice(1)), rest);
    return () => {
      clearTimeout(t);
      budget.set(head, rest - (Date.now() - started));
    };
  }, [head, paused, ms]);

  const api = useMemo<ToastApi>(() => ({ show: (t) => setQueue((q) => (q.length > 0 && !q[0].action ? [t, ...q.slice(1)] : [...q, t])), clear: () => setQueue((q) => q.slice(1)) }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastSlot toast={head ?? null} onHold={(held) => setHeldFor(held ? (head ?? null) : null)} />
    </ToastContext.Provider>
  );
}

/** Floats above the dock. The wrapper stays mounted so screen readers announce what appears in it. */
function ToastSlot({ toast, onHold }: { toast: ToastState | null; onHold: (held: boolean) => void }) {
  return (
    <div className="toast-slot" role="status">
      {toast ? (
        <div
          className="toast"
          onPointerEnter={() => onHold(true)}
          onPointerLeave={() => onHold(false)}
          onFocus={() => onHold(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) onHold(false);
          }}
        >
          <span>{toast.text}</span>
          {toast.action ? (
            <button type="button" className="ghost" onClick={toast.action.run}>
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
