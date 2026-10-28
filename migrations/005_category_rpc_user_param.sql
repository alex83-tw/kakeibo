-- 005_category_rpc_user_param.sql — 科目改名／合併 RPC 加 p_user 參數。
-- 為什麼：kakeibo 與 financial-advisor 一樣不登入，伺服器用 service role key 連線，此時 auth.uid() 是 NULL。
-- 規則：uid = coalesce(p_user, auth.uid())。仍是 SECURITY INVOKER：用 authenticated 身分呼叫時 RLS 照常生效，
--       傳別人的 p_user 只會查不到資料；service role 繞過 RLS，範圍由 uid 限定。
-- 乾跑：把最後的 COMMIT 改成 ROLLBACK。需先執行 004。
BEGIN;

-- 舊簽名（沒有 p_user）先移除，避免與新函式並存而呼叫模稜兩可。
DROP FUNCTION IF EXISTS financial.category_usage(text, text, text);
DROP FUNCTION IF EXISTS financial.rename_or_merge_category(text, text, text, text, text);

CREATE OR REPLACE FUNCTION financial.category_usage(p_user uuid, p_kind text, p_main text, p_sub text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'entries', (SELECT count(*) FROM financial.accounting_entries e
                WHERE e.user_id = coalesce(p_user, auth.uid()) AND e.deleted_at IS NULL AND e.entry_type = p_kind
                  AND e.main_category = p_main
                  AND (p_sub IS NULL OR coalesce(e.sub_category, 'other') = p_sub)),
    'budgets', CASE WHEN p_kind = 'expense' THEN
                 (SELECT count(*) FROM financial.budget_plans b
                  WHERE b.user_id = coalesce(p_user, auth.uid()) AND b.main_category = p_main
                    AND (p_sub IS NULL OR b.sub_category = p_sub))
               ELSE 0 END,
    'rules', (SELECT count(*) FROM financial.category_rules r
              WHERE r.user_id = coalesce(p_user, auth.uid()) AND r.entry_type = p_kind AND r.main_category = p_main
                AND (p_sub IS NULL OR coalesce(r.sub_category, 'other') = p_sub)),
    'recurring', (SELECT count(*) FROM financial.recurring_rules c
                  WHERE c.user_id = coalesce(p_user, auth.uid()) AND c.entry_type = p_kind AND c.main_category = p_main
                    AND (p_sub IS NULL OR c.sub_category = p_sub))
  );
$$;

CREATE OR REPLACE FUNCTION financial.rename_or_merge_category(
  p_user uuid, p_kind text, p_from_main text, p_from_sub text, p_to_main text, p_to_sub text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  uid uuid := coalesce(p_user, auth.uid());
  n_entries int := 0;
  n_rules int := 0;
  n_recurring int := 0;
  n_budgets int := 0;
  n_conflicts int := 0;
  b financial.budget_plans;
  t financial.budget_plans;
  new_sub text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_kind NOT IN ('expense', 'income') THEN RAISE EXCEPTION 'invalid kind: %', p_kind; END IF;
  IF p_from_sub IS NOT NULL AND p_to_sub IS NULL THEN RAISE EXCEPTION 'p_to_sub is required when p_from_sub is given'; END IF;

  IF p_from_main = p_to_main AND (p_from_sub IS NULL OR p_from_sub = p_to_sub) THEN
    RETURN jsonb_build_object('entries', 0, 'budgets', 0, 'rules', 0, 'recurring', 0, 'budget_conflicts', 0);
  END IF;

  WITH u AS (
    UPDATE financial.accounting_entries e
       SET main_category = p_to_main,
           sub_category = CASE WHEN p_from_sub IS NULL THEN e.sub_category ELSE p_to_sub END,
           updated_at = now()
     WHERE e.user_id = uid AND e.entry_type = p_kind AND e.main_category = p_from_main
       AND (p_from_sub IS NULL OR coalesce(e.sub_category, 'other') = p_from_sub)
    RETURNING e.deleted_at)
  SELECT count(*) FILTER (WHERE deleted_at IS NULL) INTO n_entries FROM u;

  WITH u AS (
    UPDATE financial.category_rules r
       SET main_category = p_to_main,
           sub_category = CASE WHEN p_from_sub IS NULL THEN r.sub_category ELSE p_to_sub END,
           updated_at = now()
     WHERE r.user_id = uid AND r.entry_type = p_kind AND r.main_category = p_from_main
       AND (p_from_sub IS NULL OR coalesce(r.sub_category, 'other') = p_from_sub)
    RETURNING 1)
  SELECT count(*) INTO n_rules FROM u;

  WITH u AS (
    UPDATE financial.recurring_rules c
       SET main_category = p_to_main,
           sub_category = CASE WHEN p_from_sub IS NULL THEN c.sub_category ELSE p_to_sub END,
           updated_at = now()
     WHERE c.user_id = uid AND c.entry_type = p_kind AND c.main_category = p_from_main
       AND (p_from_sub IS NULL OR c.sub_category = p_from_sub)
    RETURNING 1)
  SELECT count(*) INTO n_recurring FROM u;

  IF p_kind = 'expense' THEN
    FOR b IN
      SELECT * FROM financial.budget_plans x
       WHERE x.user_id = uid AND x.main_category = p_from_main
         AND (p_from_sub IS NULL OR x.sub_category = p_from_sub)
       ORDER BY x.period_year, x.period_month
    LOOP
      n_budgets := n_budgets + 1;
      new_sub := CASE WHEN p_from_sub IS NULL THEN b.sub_category ELSE p_to_sub END;

      SELECT * INTO t FROM financial.budget_plans x
       WHERE x.user_id = uid AND x.period_year = b.period_year AND x.period_month = b.period_month
         AND x.main_category = p_to_main AND x.sub_category = new_sub AND x.id <> b.id;

      IF NOT FOUND THEN
        UPDATE financial.budget_plans SET main_category = p_to_main, sub_category = new_sub, updated_at = now()
         WHERE id = b.id;
      ELSIF t.currency = b.currency THEN
        UPDATE financial.budget_plans
           SET budget_amount = t.budget_amount + b.budget_amount,
               rollover_amount = coalesce(t.rollover_amount, 0) + coalesce(b.rollover_amount, 0),
               updated_at = now()
         WHERE id = t.id;
        DELETE FROM financial.budget_plans WHERE id = b.id;
      ELSE
        n_conflicts := n_conflicts + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('entries', n_entries, 'budgets', n_budgets, 'rules', n_rules,
                            'recurring', n_recurring, 'budget_conflicts', n_conflicts);
END;
$$;

GRANT EXECUTE ON FUNCTION financial.category_usage(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION financial.rename_or_merge_category(uuid, text, text, text, text, text) TO authenticated, service_role;

COMMIT;
