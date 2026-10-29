-- 007_collapse_sub_budgets.sql — 把「本月」子科目層級的預算加總成主分類預算（sub_category = 'other'）。
-- 為什麼：舊 app 的預算設在子科目（居住/房租、居住/水費…），kakeibo 只讀 sub_category = 'other' 的主分類預算，
--         所以這些預算在 kakeibo 看不到。加總後 kakeibo 的預算頁與首頁才有數字。
-- 範圍：只動 uid 這位使用者、只動 y 年 m 月；舊月份保持原樣（下個月按「沿用上月預算」會從這個月複製主分類預算）。
-- 做法：每個有子科目預算的主分類，把該主分類本月所有列（含已有的 'other'）金額與 rollover 加總，
--       留下一列（已有 'other' 就用它，否則用第一個子科目的列）改成 'other'，其餘刪除。不新增列。
-- 可重跑：跑完沒有子科目列了，第二次什麼都不做。
-- 不能相加就中止：同一主分類本月有多種幣別。
-- 乾跑：檔尾預設 ROLLBACK；先單獨跑 007a 存下執行前快照，確認 NOTICE 與最後的查詢，再把 ROLLBACK 改成 COMMIT。
BEGIN;

DO $$
DECLARE
  uid uuid := '00000000-0000-0000-0000-000000000000'; -- 若你設了 KAKEIBO_USER_ID，改成那個
  y int := 2026;
  m int := 10;
  g record;
  keep financial.budget_plans;
  sum_amt numeric;
  sum_roll numeric;
  n_rows int;
  total_before numeric;
  total_after numeric;
  n_left int;
BEGIN
  SELECT coalesce(sum(budget_amount), 0) INTO total_before
    FROM financial.budget_plans WHERE user_id = uid AND period_year = y AND period_month = m;

  FOR g IN
    SELECT main_category FROM financial.budget_plans
     WHERE user_id = uid AND period_year = y AND period_month = m
     GROUP BY main_category
    HAVING bool_or(sub_category <> 'other')
     ORDER BY main_category
  LOOP
    IF (SELECT count(DISTINCT currency) FROM financial.budget_plans
         WHERE user_id = uid AND period_year = y AND period_month = m AND main_category = g.main_category) > 1 THEN
      RAISE EXCEPTION 'FAIL: % 本月有多種幣別，無法相加，中止', g.main_category;
    END IF;

    SELECT sum(budget_amount), sum(coalesce(rollover_amount, 0)), count(*) INTO sum_amt, sum_roll, n_rows
      FROM financial.budget_plans
     WHERE user_id = uid AND period_year = y AND period_month = m AND main_category = g.main_category;

    SELECT * INTO keep FROM financial.budget_plans
     WHERE user_id = uid AND period_year = y AND period_month = m AND main_category = g.main_category
     ORDER BY (sub_category = 'other') DESC, sub_category
     LIMIT 1;

    UPDATE financial.budget_plans
       SET sub_category = 'other', budget_amount = sum_amt, rollover_amount = sum_roll, updated_at = now()
     WHERE id = keep.id;

    DELETE FROM financial.budget_plans
     WHERE user_id = uid AND period_year = y AND period_month = m AND main_category = g.main_category AND id <> keep.id;

    RAISE NOTICE '%：% 列 → 1 列，預算 %', g.main_category, n_rows, sum_amt;
  END LOOP;

  SELECT coalesce(sum(budget_amount), 0) INTO total_after
    FROM financial.budget_plans WHERE user_id = uid AND period_year = y AND period_month = m;
  IF total_after <> total_before THEN RAISE EXCEPTION 'FAIL: 本月預算總額 % → %', total_before, total_after; END IF;

  SELECT count(*) INTO n_left FROM financial.budget_plans
   WHERE user_id = uid AND period_year = y AND period_month = m AND sub_category <> 'other';
  IF n_left <> 0 THEN RAISE EXCEPTION 'FAIL: 本月仍有 % 列子科目預算', n_left; END IF;

  RAISE NOTICE 'OK: 本月預算總額 % 不變，全部是主分類預算', total_after;
END $$;

-- 結果：本月每個主分類一列；kakeibo 的預算頁應該看到同樣的數字。
SELECT main_category, sub_category, budget_amount, currency, rollover_amount, warning_threshold
FROM financial.budget_plans
WHERE user_id = '00000000-0000-0000-0000-000000000000' AND period_year = 2026 AND period_month = 10
ORDER BY main_category;

ROLLBACK; -- 確認無誤後改成 COMMIT;
