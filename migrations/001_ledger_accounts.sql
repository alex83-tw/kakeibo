-- 001_ledger_accounts.sql — 帳戶表。乾跑：把最後的 COMMIT 改成 ROLLBACK。
BEGIN;

CREATE TABLE IF NOT EXISTS financial.ledger_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT auth.uid(),
  kind            text NOT NULL CHECK (kind IN ('cash', 'bank', 'e_wallet', 'credit_card')),
  name            text NOT NULL,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  opening_date    date NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  archived        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_accounts_user_sort_idx
  ON financial.ledger_accounts (user_id, sort_order);

ALTER TABLE financial.ledger_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ledger_accounts_user_policy ON financial.ledger_accounts
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON financial.ledger_accounts TO authenticated;

COMMIT;
