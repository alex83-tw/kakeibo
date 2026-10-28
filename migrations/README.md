# migrations

線上 DB（Supabase，`financial` schema）由使用者在 SQL editor 手動執行。每個檔都是交易＋idempotent，可重跑。

**乾跑**：先把檔尾的 `COMMIT;` 改成 `ROLLBACK;` 跑一次確認沒有錯誤，再改回 `COMMIT;` 正式執行。

執行順序：`001` → `002` → `003` → `004` → `tests/004_assert.sql`（成功 = 「Success. No rows returned」；失敗 = `ERROR: FAIL: …`）。
`000_introspect.sql` 是唯讀查詢，已執行，結果在 `docs/schema-snapshot.md`。

| 檔名 | 內容 | 狀態 | 執行日期 |
|---|---|---|---|
| 000_introspect.sql | 唯讀 schema 快照 | 已執行 | 2026-10-29 |
| 001_ledger_accounts.sql | 帳戶表 | 待執行 | |
| 002_entries_transfer.sql | `deleted_at`、帳戶欄、轉帳（`entry_type` 加 CHECK） | 待執行 | |
| 003_reconciliations.sql | 對帳紀錄（`diff` 為 generated column，寫入不要帶） | 待執行 | |
| 004_category_rename_merge.sql | `rename_or_merge_category`、`category_usage` | 待執行 | |
| tests/004_assert.sql | 驗證 004（ROLLBACK，不留資料） | 待執行 | |

注意：新表沒有 `updated_at` trigger，更新時由程式明確寫入 `updated_at`。
