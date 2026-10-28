-- cleanup_assert_fixtures.sql — 清掉 004_assert／005_assert 殘留的測試資料（只動兩個假的 user_id）。
-- 先 SELECT 看筆數，確認都是測試資料（分類是 餐飲／飲食、user_id 是 aaaaaaaa-…／bbbbbbbb-…）再 DELETE。
-- 這支會 COMMIT（真的刪除）；乾跑請把最後的 COMMIT 改成 ROLLBACK。
BEGIN;

SELECT 'accounting_entries' AS t, count(*) FROM financial.accounting_entries WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')
UNION ALL SELECT 'budget_plans', count(*) FROM financial.budget_plans WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')
UNION ALL SELECT 'category_rules', count(*) FROM financial.category_rules WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')
UNION ALL SELECT 'recurring_rules', count(*) FROM financial.recurring_rules WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

DELETE FROM financial.accounting_entries WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
DELETE FROM financial.budget_plans       WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
DELETE FROM financial.category_rules     WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
DELETE FROM financial.recurring_rules    WHERE user_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

COMMIT;
