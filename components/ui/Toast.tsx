"use client";

import { useEffect, useState } from "react";

export interface ToastState {
  text: string;
  action?: { label: string; run: () => void };
}

/** One toast at a time; it clears itself after `ms`. */
export function useToast(ms = 5000) {
  const [toast, show] = useState<ToastState | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => show(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  return { toast, show, clear: () => show(null) };
}

/** Floats above the dock. The wrapper stays mounted so screen readers announce what appears in it. */
export function ToastSlot({ toast }: { toast: ToastState | null }) {
  return (
    <div className="toast-slot" role="status">
      {toast ? (
        <div className="toast">
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
