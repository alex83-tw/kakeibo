-- 006_merge_legacy_categories.sql — 把舊 financial-advisor 的支出科目併進 kakeibo 的 12 個主分類。
-- 不依賴 005 的 RPC（005 還沒執行也能跑）。只改：accounting_entries、category_rules、recurring_rules、budget_plans 的科目欄位與 updated_at。
-- 乾跑：檔尾預設是 ROLLBACK。先跑 006a 盤點確認沒有漏掉的舊名稱，再跑本檔看 NOTICE 與最後的查詢；沒問題再把檔尾改成 COMMIT。
-- 備份提醒：合併不可逆。執行 COMMIT 前請先在 SQL editor 匯出 006a 的結果（或 Supabase 備份）。
--
-- 對應（使用者 2026-10-29 確認）：
--   整個主分類改名、子科目保留：飲食→餐飲、學習→學習成長、交際→人情社交、購物→日用購物、娛樂→娛樂休閒、醫療→醫療保健
--   降成子科目（舊子科目全部併入）：旅行→娛樂休閒／旅遊、寵物→家庭／寵物
-- 預算：kakeibo 只讀 sub_category='other' 的主分類預算（lib/server/repos/budgets.ts listBudgets），
--   所以降成子科目的預算也折回 (新主分類,'other')，不會變成讀不到的子層級列。
-- 撞鍵（同月同新主分類已有預算）：同幣別相加，幣別不同則中止。
BEGIN;

DO $$
DECLARE
  uid uuid;
  m record;
  b financial.budget_plans;
  t financial.budget_plans;
  new_sub text;
  n_before_e int; n_after_e int;
  n_before_r int; n_after_r int;
  n_before_c int; n_after_c int;
  n_left int;
BEGIN
  -- 只有一位使用者才安全；多位就中止。
  IF (SELECT count(DISTINCT user_id) FROM financial.accounting_entries) <> 1 THEN
    RAISE EXCEPTION 'FAIL: accounting_entries 不是剛好一位 user_id，中止';
  END IF;
  SELECT DISTINCT user_id INTO uid FROM financial.accounting_entries;

  SELECT count(*) INTO n_before_e FROM financial.accounting_entries WHERE user_id = uid;
  SELECT count(*) INTO n_before_r FROM financial.category_rules     WHERE user_id = uid;
  SELECT count(*) INTO n_before_c FROM financial.recurring_rules    WHERE user_id = uid;

  FOR m IN
    SELECT * FROM (VALUES
      ('飲食', '餐飲',     NULL::text),
      ('學習', '學習成長', NULL),
      ('交際', '人情社交', NULL),
      ('購物', '日用購物', NULL),
      ('娛樂', '娛樂休閒', NULL),
      ('醫療', '醫療保健', NULL),
      ('旅行', '娛樂休閒', '旅遊'),
      ('寵物', '家庭',     '寵物')
    ) AS v(from_main, to_main, to_sub)
  LOOP
    UPDATE financial.accounting_entries
       SET main_category = m.to_main,
           sub_category  = coalesce(m.to_sub, sub_category),
           updated_at    = now()
     WHERE user_id = uid AND entry_type = 'expense' AND main_category = m.from_main;

    UPDATE financial.category_rules
       SET main_category = m.to_main,
           sub_category  = coalesce(m.to_sub, sub_category),
           updated_at    = now()
     WHERE user_id = uid AND entry_type = 'expense' AND main_category = m.from_main;

    UPDATE financial.recurring_rules
       SET main_category = m.to_main,
           sub_category  = coalesce(m.to_sub, sub_category),
           updated_at    = now()
     WHERE user_id = uid AND entry_type = 'expense' AND main_category = m.from_main;

    FOR b IN
      SELECT * FROM financial.budget_plans x
       WHERE x.user_id = uid AND x.main_category = m.from_main
       ORDER BY x.period_year, x.period_month, x.sub_category
    LOOP
      new_sub := CASE WHEN m.to_sub IS NULL THEN b.sub_category ELSE 'other' END;

      SELECT * INTO t FROM financial.budget_plans x
       WHERE x.user_id = uid AND x.period_year = b.period_year AND x.period_month = b.period_month
         AND x.main_category = m.to_main AND x.sub_category = new_sub AND x.id <> b.id;

      IF NOT FOUND THEN
        UPDATE financial.budget_plans
           SET main_category = m.to_main, sub_category = new_sub, updated_at = now()
         WHERE id = b.id;
      ELSIF t.currency = b.currency THEN
        UPDATE financial.budget_plans
           SET budget_amount   = t.budget_amount + b.budget_amount,
               rollover_amount = coalesce(t.rollover_amount, 0) + coalesce(b.rollover_amount, 0),
               updated_at      = now()
         WHERE id = t.id;
        DELETE FROM financial.budget_plans WHERE id = b.id;
      ELSE
        RAISE EXCEPTION 'FAIL: 預算 % % 年 % 月幣別不同（% vs %），無法相加，中止',
          m.from_main, b.period_year, b.period_month, b.currency, t.currency;
      END IF;
    END LOOP;
  END LOOP;

  -- 斷言：筆數不變、舊名稱不再出現。
  SELECT count(*) INTO n_after_e FROM financial.accounting_entries WHERE user_id = uid;
  SELECT count(*) INTO n_after_r FROM financial.category_rules     WHERE user_id = uid;
  SELECT count(*) INTO n_after_c FROM financial.recurring_rules    WHERE user_id = uid;
  IF n_after_e <> n_before_e THEN RAISE EXCEPTION 'FAIL: accounting_entries 筆數 % → %', n_before_e, n_after_e; END IF;
  IF n_after_r <> n_before_r THEN RAISE EXCEPTION 'FAIL: category_rules 筆數 % → %', n_before_r, n_after_r; END IF;
  IF n_after_c <> n_before_c THEN RAISE EXCEPTION 'FAIL: recurring_rules 筆數 % → %', n_before_c, n_after_c; END IF;

  SELECT
    (SELECT count(*) FROM financial.accounting_entries WHERE user_id = uid AND entry_type = 'expense'
        AND main_category IN ('飲食','學習','交際','購物','娛樂','醫療','旅行','寵物'))
  + (SELECT count(*) FROM financial.category_rules  WHERE user_id = uid AND entry_type = 'expense'
        AND main_category IN ('飲食','學習','交際','購物','娛樂','醫療','旅行','寵物'))
  + (SELECT count(*) FROM financial.recurring_rules WHERE user_id = uid AND entry_type = 'expense'
        AND main_category IN ('飲食','學習','交際','購物','娛樂','醫療','旅行','寵物'))
  + (SELECT count(*) FROM financial.budget_plans    WHERE user_id = uid
        AND main_category IN ('飲食','學習','交際','購物','娛樂','醫療','旅行','寵物'))
  INTO n_left;
  IF n_left <> 0 THEN RAISE EXCEPTION 'FAIL: 仍有 % 列使用舊科目名稱', n_left; END IF;

  RAISE NOTICE 'OK: entries=% rules=% recurring=% 筆數不變，舊名稱已清空', n_after_e, n_after_r, n_after_c;
END $$;

-- 還沒對到 kakeibo 12 個主分類的支出科目（自訂科目或漏掉的舊名稱）；有列出就回頭補對應表。
SELECT 'entries' AS src, main_category, count(*) AS n
  FROM financial.accounting_entries
 WHERE entry_type = 'expense'
   AND main_category NOT IN ('餐飲','交通','居住','日用購物','醫療保健','娛樂休閒','學習成長','人情社交','家庭','保險','稅費','其他')
 GROUP BY main_category
 ORDER BY n DESC;

ROLLBACK; -- 確認無誤後改成 COMMIT;
