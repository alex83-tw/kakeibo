-- 008a_exchange_rates_introspect.sql — 唯讀。在 Supabase SQL editor 執行，把「每一段」的結果貼回來。
-- 目的：外幣帳目要用 entry 當天匯率換算成 TWD，先確認 exchange_rates 的實際欄位與資料。不會修改任何資料。

-- 1) 欄位（名稱、型別、可否為 NULL、預設值）
select table_schema, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'exchange_rates'
order by table_schema, ordinal_position;

-- 2) 約束與 RLS 政策
select n.nspname as table_schema, con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where c.relname = 'exchange_rates';

select schemaname, policyname, cmd, qual, with_check
from pg_policies
where tablename = 'exchange_rates';

-- 3) 各幣別對 TWD 的資料量、日期範圍、最新一筆
select from_currency, to_currency, count(*) as n, min(date) as first_date, max(date) as last_date,
       (array_agg(rate order by date desc))[1] as latest_rate
from financial.exchange_rates
group by from_currency, to_currency
order by from_currency, to_currency;

-- 4) 外幣帳目的幣別與日期範圍（對照上面看有沒有涵蓋）
select currency, count(*) as n, min(entry_date) as first_date, max(entry_date) as last_date
from financial.accounting_entries
where currency <> 'TWD' and deleted_at is null
group by currency;
