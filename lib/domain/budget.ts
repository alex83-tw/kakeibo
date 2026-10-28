import { dayOfMonth } from "@/lib/time";

export type BudgetStatus = "over" | "projected-over" | "warning" | "ok";

export interface BudgetProgress {
  available: number;
  remaining: number;
  ratio: number;
  projected: number;
  status: BudgetStatus;
}

export function daysElapsed(today: string): number {
  return dayOfMonth(today);
}

/**
 * Status priority: over > projected-over > warning > ok.
 * Rollover counts toward what is available. A category without a budget never alerts.
 */
export function budgetProgress(input: {
  budget: number;
  rollover: number;
  spent: number;
  warningThreshold: number;
  daysElapsed: number;
  daysInMonth: number;
}): BudgetProgress {
  const available = input.budget + input.rollover;
  const remaining = available - input.spent;
  const ratio = available > 0 ? input.spent / available : 0;
  const projected = (input.spent / Math.max(1, input.daysElapsed)) * input.daysInMonth;

  let status: BudgetStatus = "ok";
  if (available > 0) {
    if (input.spent > available) status = "over";
    else if (projected > available) status = "projected-over";
    else if (ratio >= input.warningThreshold) status = "warning";
  }
  return { available, remaining, ratio, projected, status };
}
