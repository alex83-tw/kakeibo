-- 002_entries_transfer.sql — 帳目：軟刪除、帳戶、轉帳。需先執行 001。乾跑：把最後的 COMMIT 改成 ROLLBACK。
-- 線上 accounting_entries 沒有任何 CHECK 約束，也沒有 deleted_at（見 docs/schema-snapshot.md）。
-- 轉帳列：main_category 固定 '轉帳'、sub_category 固定 'other'（main_category 是 NOT NULL）。
BEGIN;

ALTER TABLE financial.accounting_entries
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS account_id          uuid,
  ADD COLUMN IF NOT EXISTS transfer_account_id uuid;

-- 複合外鍵：帳戶必須屬於同一個 user_id（NULL 不檢查）。
DO $$ BEGIN
  ALTER TABLE financial.accounting_entries
    ADD CONSTRAINT accounting_entries_account_fk
    FOREIGN KEY (account_id, user_id) REFERENCES financial.ledger_accounts (id, user_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE financial.accounting_entries
    ADD CONSTRAINT accounting_entries_transfer_account_fk
    FOREIGN KEY (transfer_account_id, user_id) REFERENCES financial.ledger_accounts (id, user_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE financial.accounting_entries
    ADD CONSTRAINT accounting_entries_entry_type_check
    CHECK (entry_type IN ('income', 'expense', 'transfer'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 轉帳 <=> 有轉入帳戶；轉帳兩端都要有帳戶且不能相同。
-- （不能用 IS DISTINCT FROM：非轉帳列兩欄皆 NULL 時會是 false。）
DO $$ BEGIN
  ALTER TABLE financial.accounting_entries
    ADD CONSTRAINT transfer_shape
    CHECK (
      (entry_type = 'transfer') = (transfer_account_id IS NOT NULL)
      AND (transfer_account_id IS NULL
           OR (account_id IS NOT NULL AND transfer_account_id <> account_id))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS accounting_entries_user_date_live_idx
  ON financial.accounting_entries (user_id, entry_date)
  WHERE deleted_at IS NULL;

COMMIT;
