# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Proposed during brainstorming, not yet signed off in a written design: Next.js 16 (App Router), TypeScript, Tailwind CSS 4 with Radix UI, React Query, Recharts, Supabase, Vercel, Vitest. It reuses the stack of the existing financial-advisor app. The user chose to share the existing Supabase database, so no new database is created and no data is migrated.

## Users
One person, the owner, using it alone. Mobile-first: opened every day on a phone to record spending and check where the month stands. Desktop is occasional, for monthly review and reconciliation. All UI text is Traditional Chinese (Taiwan).

## Product Purpose
kakeibo (家計簿) is a household ledger split out of the larger financial-advisor app. It covers income, expenses, budget consumption, cash flow and bookkeeping accuracy only. It has no investments, assets, retirement, debts or insurance management. Success: recording an entry takes seconds, today's and this month's position are visible at a glance, and the books can be trusted because every entry has an account and problems are flagged.

## Positioning
Built like an accountant's ledger rather than a spending-tracker toy: every entry carries a category (major and minor item, 科目-style) and the account it was paid from or received into, transfers between accounts are not counted as income or expense, and the app flags bookkeeping problems (duplicates, missed recurring items, uncategorised entries, reconciliation differences) as well as budget overruns.

## Operating Context
- Home screen is "today first": today's total and today's entries, a large "record an entry" action, a compact month progress / projected month-end / mini trend, an alert row, and an account balance summary.
- Budgets exist at the major-category level only. Minor categories are detail labels for recording and viewing, with no budget and no alerts. The default taxonomy is roughly 12 expense and 6 income major categories with about 60 expense minor categories.
- Accounts: cash, bank, e-payment, credit card. Account balance is opening balance plus all movements. A transfer entry type moves money between accounts. Old entries without an account go to an "unspecified" account.
- Cash flow page shows this month's income, expense and net, plus current account balances. There are no forecasts.
- Reconciliation: the user enters an actual balance on a date, and the app compares it with the computed balance and alerts on a difference.
- Alerts are budget-level (warning threshold, projected month-end overspend, once per threshold per month, rolled into a daily digest) and bookkeeping-level (duplicate entry, missing recurring item, abnormal amount, uncategorised entry, reconciliation difference).

## Capabilities and Constraints
- Reuses the existing `financial` schema in the shared Supabase project: entries, categories, category rules, recurring rules, budget plans, soft delete, CSV import and export.
- Single user, existing sign-in. Multi-currency: TWD/USD/JPY, stored in the original currency and converted to TWD at the entry-date rate when read (same as financial-advisor).
- Known bugs in the old alert logic to fix when the code is ported: the "一般" budget key mismatch, the warning threshold being ignored in overspend alerts, and the UTC month boundary error in Taiwan time.
- Undecided: whether old entries get re-categorised into the new minor categories (current lean: no rewrite, optional batch re-categorise later), the final default category list.

## Brand Commitments
The name kakeibo comes from the Japanese 家計簿. The user wants the visual concept to start from Japanese household ledger culture. No logo, palette or typeface is pinned. The old app's MUJI-style green palette may be replaced.

## Evidence on Hand
The existing financial-advisor repository at /Users/hungli/dev/personal/finance/financial-advisor holds working accounting, budget, category, recurring-rule and alert code, plus real user data in the shared database. No real kakeibo screens exist yet. Mockups are synthetic and must be labelled so.

## Product Principles
- Fast entry beats completeness: a minor category is optional and defaults to "一般".
- Show the present: today and this month, not the future.
- Trustworthy books: every entry has an account, and bookkeeping problems surface as alerts.
- Budget at the level the owner actually manages, the major category; minor detail stays quiet.
- Alert sparingly: one notice per threshold per month, with a daily digest.

## Accessibility & Inclusion
Traditional Chinese (Taiwan) typography must read well at small phone sizes. Money amounts need clear tabular alignment. Status must not rely on colour alone.
