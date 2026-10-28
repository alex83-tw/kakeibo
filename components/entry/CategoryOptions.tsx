"use client";

import { createContext, useContext, type ReactNode } from "react";

export type CategoryOptions = Record<"expense" | "income", Record<string, readonly string[]>>;

const Ctx = createContext<CategoryOptions | null>(null);

/** The categories the entry form offers: the built-in taxonomy plus names the user created by rename or typing. */
export function CategoryOptionsProvider({ value, children }: { value: CategoryOptions; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** null outside a provider; the form then falls back to the built-in taxonomy. */
export const useCategoryOptions = () => useContext(Ctx);
