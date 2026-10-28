-- 005_assert.sql — 驗證 005 的 RPC（帶 p_user、沒有 auth.uid() 的 service role 情境）。全程在交易內，最後 ROLLBACK，不留任何資料。
-- 在 SQL editor（postgres 角色）執行。成功 = 「Success. No rows returned」；
-- 失敗 = 出現 ERROR: FAIL: <哪一項>。需先執行 001–005。
BEGIN;

-- 夾具：A 是「我」，B 是另一位使用者（不得被動到）。
CREATE TEMP TABLE _u AS SELECT 'aaaaaaaa-0000-0000-0000-000000000001'::uuid AS a, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid AS b;

-- 先清掉這兩個假 user_id 可能殘留的資料（上次沒 ROLLBACK 成功時，帳目沒有唯一鍵會重複、預算會撞鍵）。
DELETE FROM financial.accounting_entries WHERE user_id IN (SELECT a FROM _u UNION SELECT b FROM _u);
DELETE FROM financial.budget_plans       WHERE user_id IN (SELECT a FROM _u UNION SELECT b FROM _u);
DELETE FROM financial.category_rules     WHERE user_id IN (SELECT a FROM _u UNION SELECT b FROM _u);
DELETE FROM financial.recurring_rules    WHERE user_id IN (SELECT a FROM _u UNION SELECT b FROM _u);

INSERT INTO financial.accounting_entries (user_id, entry_type, main_category, sub_category, amount, currency, entry_date, deleted_at)
SELECT a, 'expense', '餐飲', '飲料', 60,  'TWD', '2026-10-01'::date, NULL::timestamptz FROM _u UNION ALL
SELECT a, 'expense', '餐飲', '飲料', 70,  'TWD', '2026-10-02', NULL FROM _u UNION ALL
SELECT a, 'expense', '餐飲', '飲料', 80,  'TWD', '2026-10-03', now() FROM _u UNION ALL      -- 軟刪除
SELECT a, 'expense', '餐飲', 'other', 90, 'TWD', '2026-10-04', NULL FROM _u UNION ALL
SELECT a, 'expense', '餐飲', NULL,    95, 'TWD', '2026-10-05', NULL FROM _u UNION ALL         -- sub 為 NULL = other
SELECT a, 'income',  '餐飲', '飲料', 11, 'TWD', '2026-10-06', NULL FROM _u UNION ALL         -- 另一種類型，不得動
SELECT a, 'expense', '飲食', 'other', 33, 'TWD', '2026-10-07', NULL FROM _u UNION ALL
SELECT b, 'expense', '餐飲', '飲料', 22, 'TWD', '2026-10-01', NULL FROM _u;

INSERT INTO financial.budget_plans (user_id, main_category, sub_category, budget_amount, currency, period_year, period_month, rollover_amount)
SELECT a, '餐飲', '飲料', 2000, 'TWD', 2026, 10, 100 FROM _u UNION ALL
SELECT a, '餐飲', 'other', 3000, 'TWD', 2026, 10, 0   FROM _u UNION ALL
SELECT a, '餐飲', '飲料', 1500, 'TWD', 2026, 11, 0   FROM _u UNION ALL
SELECT a, '飲食', 'other', 700,  'TWD', 2026, 10, 0   FROM _u UNION ALL
SELECT a, '飲食', 'other', 50,   'USD', 2026, 11, 0   FROM _u UNION ALL                      -- 與 餐飲/other 2026-11 撞鍵但幣別不同
SELECT b, '餐飲', '飲料', 1000, 'TWD', 2026, 10, 0   FROM _u;

INSERT INTO financial.category_rules (user_id, keyword, main_category, sub_category, entry_type)
SELECT a, 'tea', '餐飲', '飲料', 'expense' FROM _u UNION ALL
SELECT b, 'tea', '餐飲', '飲料', 'expense' FROM _u;

INSERT INTO financial.recurring_rules (user_id, entry_type, main_category, sub_category, amount_twd_min, amount_twd_max, frequency, start_date)
SELECT a, 'expense', '餐飲', '飲料', 100, 100, 'monthly', '2026-01-05' FROM _u;

-- 不設 JWT claims：auth.uid() 為 NULL，模擬 service role；身分只靠 p_user。

DO $$
DECLARE
  ua uuid := (SELECT _u.a FROM _u);
  ub uuid := (SELECT _u.b FROM _u);
  preview jsonb; r jsonb;
BEGIN
  -- 1) 預覽與實際一致（子分類合併：餐飲/飲料 → 餐飲/other）
  preview := financial.category_usage(ua, 'expense', '餐飲', '飲料');
  r := financial.rename_or_merge_category(ua, 'expense', '餐飲', '飲料', '餐飲', 'other');
  IF preview->>'entries' <> '2' OR preview->>'budgets' <> '2' OR preview->>'rules' <> '1' OR preview->>'recurring' <> '1' THEN
    RAISE EXCEPTION 'FAIL: preview counts % ', preview; END IF;
  IF (r->>'entries', r->>'budgets', r->>'rules', r->>'recurring') IS DISTINCT FROM ('2', '2', '1', '1') THEN
    RAISE EXCEPTION 'FAIL: apply counts % (preview was %)', r, preview; END IF;

  -- 2) 帳目全數轉到目標（含軟刪除），其他種類與他人不變
  IF (SELECT count(*) FROM financial.accounting_entries WHERE user_id = ua AND entry_type = 'expense' AND main_category = '餐飲' AND sub_category = '飲料') <> 0 THEN
    RAISE EXCEPTION 'FAIL: expense rows still on old sub'; END IF;
  IF (SELECT count(*) FROM financial.accounting_entries WHERE user_id = ua AND entry_type = 'expense' AND main_category = '餐飲' AND sub_category = 'other') <> 4 THEN
    RAISE EXCEPTION 'FAIL: target should hold 3 moved (incl. 1 soft-deleted) + 1 original = 4 rows (NULL-sub row untouched)'; END IF;
  IF (SELECT count(*) FROM financial.accounting_entries WHERE user_id = ua AND entry_type = 'income' AND sub_category = '飲料') <> 1 THEN
    RAISE EXCEPTION 'FAIL: income row was touched'; END IF;
  IF (SELECT count(*) FROM financial.accounting_entries WHERE user_id = ub AND sub_category = '飲料') <> 1 THEN
    RAISE EXCEPTION 'FAIL: other user entry was touched'; END IF;

  -- 3) 預算：同月撞鍵相加成 5,000、沒有重複鍵；rollover 相加；不撞的月份直接搬
  IF (SELECT budget_amount FROM financial.budget_plans WHERE user_id = ua AND main_category = '餐飲' AND sub_category = 'other' AND period_year = 2026 AND period_month = 10) <> 5000 THEN
    RAISE EXCEPTION 'FAIL: merged budget should be 5000'; END IF;
  IF (SELECT rollover_amount FROM financial.budget_plans WHERE user_id = ua AND main_category = '餐飲' AND sub_category = 'other' AND period_year = 2026 AND period_month = 10) <> 100 THEN
    RAISE EXCEPTION 'FAIL: rollover should be summed'; END IF;
  IF (SELECT count(*) FROM financial.budget_plans WHERE user_id = ua AND main_category = '餐飲' AND sub_category = 'other' AND period_year = 2026 AND period_month = 10) <> 1 THEN
    RAISE EXCEPTION 'FAIL: duplicate budget key'; END IF;
  IF (SELECT budget_amount FROM financial.budget_plans WHERE user_id = ua AND main_category = '餐飲' AND sub_category = 'other' AND period_year = 2026 AND period_month = 11) <> 1500 THEN
    RAISE EXCEPTION 'FAIL: non-colliding month should move as is'; END IF;
  IF (SELECT budget_amount FROM financial.budget_plans WHERE user_id = ub AND sub_category = '飲料') <> 1000 THEN
    RAISE EXCEPTION 'FAIL: other user budget was touched'; END IF;

  -- 4) 自動分類與週期帳目跟著改，他人的不動
  IF (SELECT count(*) FROM financial.category_rules WHERE user_id = ua AND sub_category = 'other') <> 1
     OR (SELECT count(*) FROM financial.category_rules WHERE user_id = ub AND sub_category = '飲料') <> 1 THEN
    RAISE EXCEPTION 'FAIL: category_rules'; END IF;
  IF (SELECT count(*) FROM financial.recurring_rules WHERE user_id = ua AND sub_category = 'other') <> 1 THEN
    RAISE EXCEPTION 'FAIL: recurring_rules'; END IF;

  -- 5) 來源沒有任何帳目：回 0、不報錯
  r := financial.rename_or_merge_category(ua, 'expense', '不存在', '不存在', '餐飲', 'other');
  IF (r->>'entries', r->>'budgets', r->>'rules', r->>'recurring') IS DISTINCT FROM ('0', '0', '0', '0') THEN
    RAISE EXCEPTION 'FAIL: empty source should return zeros, got %', r; END IF;

  -- 6) 主分類改名成已存在的名稱 = 合併（飲食 → 餐飲）；幣別不同的撞鍵不相加
  preview := financial.category_usage(ua, 'expense', '飲食', NULL);
  r := financial.rename_or_merge_category(ua, 'expense', '飲食', NULL, '餐飲', NULL);
  IF preview->>'entries' <> r->>'entries' OR preview->>'budgets' <> r->>'budgets' THEN
    RAISE EXCEPTION 'FAIL: main-level preview % vs apply %', preview, r; END IF;
  IF (SELECT count(*) FROM financial.accounting_entries WHERE user_id = ua AND main_category = '飲食') <> 0 THEN
    RAISE EXCEPTION 'FAIL: main merge left entries behind'; END IF;
  IF (SELECT budget_amount FROM financial.budget_plans WHERE user_id = ua AND main_category = '餐飲' AND sub_category = 'other' AND period_year = 2026 AND period_month = 10) <> 5700 THEN
    RAISE EXCEPTION 'FAIL: main merge budget should be 5700'; END IF;
  IF r->>'budget_conflicts' <> '1' THEN RAISE EXCEPTION 'FAIL: currency mismatch should be reported, got %', r; END IF;
  IF (SELECT count(*) FROM financial.budget_plans WHERE user_id = ua AND main_category = '飲食' AND currency = 'USD') <> 1 THEN
    RAISE EXCEPTION 'FAIL: conflicting USD budget should stay put'; END IF;

  -- 7) 來源與目標相同：不動
  r := financial.rename_or_merge_category(ua, 'expense', '餐飲', NULL, '餐飲', NULL);
  IF r->>'entries' <> '0' THEN RAISE EXCEPTION 'FAIL: same source and target should be a no-op'; END IF;
END $$;

ROLLBACK;

