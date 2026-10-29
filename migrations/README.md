# migrations

線上 DB（Supabase，`financial` schema）由使用者在 SQL editor 手動執行。每個檔都是交易＋idempotent，可重跑。

**乾跑**：先把檔尾的 `COMMIT;` 改成 `ROLLBACK;` 跑一次確認沒有錯誤，再改回 `COMMIT;` 正式執行。

執行順序：`001` → `002` → `003` → `004` → `tests/004_assert.sql` → `005` → `tests/005_assert.sql` → `tests/cleanup_assert_fixtures.sql`（清測試殘留）→ `006a`（唯讀盤點，結果貼回確認）→ `006`（先 ROLLBACK 乾跑）→ `007a`（快照）→ `007`（先 ROLLBACK 乾跑）（成功 = 「Success. No rows returned」；失敗 = `ERROR: FAIL: …`）。
`000_introspect.sql` 是唯讀查詢，已執行，結果在 `docs/schema-snapshot.md`。

| 檔名 | 內容 | 狀態 | 執行日期 |
|---|---|---|---|
| 000_introspect.sql | 唯讀 schema 快照 | 已執行 | 2026-10-29 |
| 001_ledger_accounts.sql | 帳戶表 | 已執行 | 2026-10-29 |
| 002_entries_transfer.sql | `deleted_at`、帳戶欄、轉帳（`entry_type` 加 CHECK） | 已執行 | 2026-10-29 |
| 003_reconciliations.sql | 對帳紀錄（`diff` 為 generated column，寫入不要帶） | 已執行 | 2026-10-29 |
| 004_category_rename_merge.sql | `rename_or_merge_category`、`category_usage` | 已執行 | 2026-10-29 |
| tests/004_assert.sql | 驗證 004（ROLLBACK，不留資料） | 已驗證（2026-10-29，使用者在 SQL editor 執行，無 FAIL，ROLLBACK 後無殘留） | |
| 005_category_rpc_user_param.sql | 兩個科目 RPC 加 `p_user`（不登入、service role 下 `auth.uid()` 是 NULL）；會 DROP 舊簽名 | 已執行 | 2026-10-29 |
| tests/005_assert.sql | 驗證 005（不設 JWT claims，只靠 `p_user`；ROLLBACK；開頭先清假 user_id 殘留） | 已執行 | 2026-10-29 |
| 006a_category_inventory.sql | 唯讀：全時段盤點四張表的科目（含收入、已刪除、舊月份） | 已執行 | 2026-10-29 |
| 006_merge_legacy_categories.sql | 舊科目併進 12 個主分類（不依賴 005）；只動 uid 一位使用者 | 已執行（COMMIT） | 2026-10-29 |
| 007a_budget_current_month.sql | 唯讀：本月 budget_plans 每一列（007 的執行前快照） | 已執行 | 2026-10-29 |
| 007_collapse_sub_budgets.sql | 本月子科目預算加總成主分類預算（sub=other）；預設 ROLLBACK，含總額斷言 | 已執行（COMMIT） | 2026-10-29 |
| 008a_exchange_rates_introspect.sql | 唯讀：`exchange_rates` 欄位、約束、各幣別日期範圍（外幣換算的前置確認，結果貼回） | 待使用者執行 | |
| tests/cleanup_assert_fixtures.sql | 清掉 004／005 assert 殘留在 DB 的測試資料（只動兩個假 user_id） | 待使用者執行（見對話） | |

注意：新表沒有 `updated_at` trigger，更新時由程式明確寫入 `updated_at`。
