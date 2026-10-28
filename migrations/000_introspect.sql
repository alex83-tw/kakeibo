-- 000_introspect.sql — 唯讀。在 Supabase SQL editor 執行，把「每一段」的結果貼回來。
-- 目的：確認線上 schema 與 kakeibo 設計文件的假設是否一致。不會修改任何資料。

-- 1) 這些表在哪個 schema？
select table_schema, table_name
from information_schema.tables
where table_name in ('accounting_entries','budget_plans','budget_settings','categories',
                     'category_rules','recurring_rules','exchange_rates','ledger_accounts','reconciliations')
order by table_schema, table_name;

-- 2) 欄位（名稱、型別、可否為 NULL、預設值）
select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name in ('accounting_entries','budget_plans','budget_settings','categories',
                     'category_rules','recurring_rules')
order by table_schema, table_name, ordinal_position;

-- 3) 約束（CHECK / UNIQUE / PRIMARY KEY / FOREIGN KEY）的名稱與定義
select n.nspname as table_schema, c.relname as table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where c.relname in ('accounting_entries','budget_plans','budget_settings','categories','category_rules','recurring_rules')
order by n.nspname, c.relname, con.contype, con.conname;

-- 4) RLS 是否開啟、有哪些政策
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('accounting_entries','budget_plans','budget_settings','categories','category_rules','recurring_rules')
order by schemaname, tablename, policyname;

-- 5) 既有帳目的規模與幣別分布（只有計數，沒有內容）
select entry_type, currency, count(*) as n, count(*) filter (where deleted_at is not null) as soft_deleted
from accounting_entries
group by entry_type, currency
order by entry_type, currency;
