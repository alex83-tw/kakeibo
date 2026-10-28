-- 003_reconciliations.sql — 對帳紀錄。需先執行 001。乾跑：把最後的 COMMIT 改成 ROLLBACK。
-- diff 是 generated column（= book_balance - statement_balance），寫入時不要帶 diff。
BEGIN;

CREATE TABLE IF NOT EXISTS financial.reconciliations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid(),
  account_id        uuid NOT NULL REFERENCES financial.ledger_accounts (id) ON DELETE RESTRICT,
  statement_date    date NOT NULL,
  statement_balance numeric(18,2) NOT NULL,
  book_balance      numeric(18,2) NOT NULL,
  diff              numeric(18,2) GENERATED ALWAYS AS (book_balance - statement_balance) STORED,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reconciliations_user_account_idx
  ON financial.reconciliations (user_id, account_id, statement_date DESC);

ALTER TABLE financial.reconciliations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY reconciliations_user_policy ON financial.reconciliations
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON financial.reconciliations TO authenticated;

COMMIT;
