-- 006a_category_inventory.sql — 唯讀盤點：四張表裡「全時段」出現過的科目（含收入、已刪除帳目、舊月份）。
-- 用途：執行 006 之前先跑一次，把結果貼回對話，確認對應表沒有漏掉的舊名稱。不改任何資料。
-- 注意：Supabase SQL editor 只顯示最後一個結果，所以合成一個 UNION。

SELECT src, kind, main_category, coalesce(sub_category, 'other') AS sub, count(*) AS n
FROM (
  SELECT 'entries'   AS src, entry_type AS kind, main_category, sub_category
    FROM financial.accounting_entries WHERE entry_type <> 'transfer'
  UNION ALL
  SELECT 'budgets',   'expense',   main_category, sub_category FROM financial.budget_plans
  UNION ALL
  SELECT 'rules',     entry_type,  main_category, sub_category FROM financial.category_rules
  UNION ALL
  SELECT 'recurring', entry_type,  main_category, sub_category FROM financial.recurring_rules
) t
GROUP BY src, kind, main_category, coalesce(sub_category, 'other')
ORDER BY kind, main_category, src, sub;
