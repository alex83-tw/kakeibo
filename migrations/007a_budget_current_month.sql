-- 007a_budget_current_month.sql — 唯讀：你本月（2026 年 10 月）在 budget_plans 的每一列。
-- 007 之前先單獨跑這支，貼回結果；這就是 007 的「執行前快照」（之後要還原就照這份）。
-- 月份寫死在這裡與 007 的 DO 區塊；換月份時兩邊一起改。
SELECT main_category, sub_category, budget_amount, currency, rollover_amount, warning_threshold, over_threshold, notes, id
FROM financial.budget_plans
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND period_year = 2026 AND period_month = 10
ORDER BY main_category, sub_category <> 'other', sub_category;
