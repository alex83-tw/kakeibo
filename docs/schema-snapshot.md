# 線上 schema 快照（2026-10-29，由 `migrations/000_introspect.sql` 的結果整理）

Schema：**`financial`**。所有表 RLS 已開，政策皆為 `auth.uid() = user_id`（ALL）。`id`、`user_id` 都是 **uuid**（不是舊 repo 後來的 TEXT）。

## 與計畫假設不同之處（以快照為準）

| 計畫的假設 | 線上實際 | 處理 |
|---|---|---|
| `entry_type` 有 CHECK 約束要替換 | **`accounting_entries` 只有 pkey，沒有任何 CHECK** | 002 直接新增 CHECK（`income｜expense｜transfer`），不 DROP |
| `deleted_at` 可能已存在 | **不存在** | 002 新增 |
| `id`／`user_id` 可能是 TEXT | uuid | 新表的 `user_id` 用 `uuid default auth.uid()`，政策 `user_id = auth.uid()` |
| `budget_plans` 唯一鍵含幣別 | `UNIQUE (user_id, period_year, period_month, main_category, sub_category)`，**不含 currency** | 合併撞鍵時：同幣別相加；幣別不同無法相加，來源列留在原處並回報 `budget_conflicts` |
| 週期帳目有「每月到期日」「帳戶」欄 | `recurring_rules` 沒有 account 欄；沒有到期日欄，只有 `frequency`（monthly／quarterly／annual）、`anchor_month`、`start_date`、`end_date`、`amount_twd_min/max`、`label`、`importance`、`source`、`is_active` | Task 16 到期日取 `start_date` 的日；不存帳戶；金額用 min～max 區間 |
| `categories` 在 RPC 範圍 | 有 `categories(type,label,sub_categories[],position,is_default)`，舊 app 的自訂分類 | v1 的分類表在程式碼（`lib/domain/categories.ts`），**不讀、不改 `categories` 表**；RPC 只動帳目、預算、自動分類、週期帳目 |
| `recurring_rules.user_id` 預設 `auth.uid()` | **無預設值** | 寫入時 repo 必須明確帶 `user_id` |

## 表

- `accounting_entries`：id, user_id, entry_type, main_category, sub_category (null), amount, currency, entry_date, notes (null), is_recurring (null), created_at, updated_at。無約束。
- `budget_plans`：id, user_id, main_category, **sub_category NOT NULL**, budget_amount, currency, period_year, period_month, warning_threshold (null), over_threshold (null), notes, created_at, updated_at, rollover_amount (default 0)。
- `budget_settings`：UNIQUE(user_id)；default_warning_threshold, default_over_threshold, enable_rollover (default false) 等。
- `categories`：UNIQUE(user_id,type,label)；v1 不使用。
- `category_rules`：UNIQUE(user_id,keyword)；keyword, main_category, sub_category (null), entry_type。
- `recurring_rules`：見上；CHECK 限制 entry_type（income｜expense）、frequency、importance、source、金額區間、日期區間。
- `exchange_rates`：欄位依舊 repo 為 `from_currency, to_currency, rate, date`（**尚未對線上確認**，見 `migrations/008a_exchange_rates_introspect.sql`）。外幣帳目以 entry 當天匯率換算成 TWD。

## 資料規模（`entry_type` × `currency`）

| | TWD | JPY | USD |
|---|---|---|---|
| expense | 899 | 67 | 12 |
| income | 30 | 10 | 61 |

沒有任何 `transfer` 列。非 TWD 共 150 筆，以匯率換算後計入。
