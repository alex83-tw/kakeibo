# Lessons

使用者糾正後的規則寫在這裡，避免同樣錯誤再犯。

## 2026-10-29 「沿用 X 的機制」要讀執行期設定，不只讀登入頁程式碼
- 事件：使用者說 kakeibo 登入要「和 financial-advisor 一樣」。我只讀了它的 `login/page.tsx`，就斷定是 Email＋密碼並改了 kakeibo；實際上 financial-advisor 的 `ENABLE_AUTH` 沒開，不登入，伺服器用 service role key 繞過 RLS，所有資料掛在固定 user_id。結果做了一輪白工，還要求使用者用不存在的帳號登入。
- 規則：要仿照另一個 app 的認證／權限機制時，先查它**實際生效**的路徑：`.env*` 的變數名稱（只看名稱不看值）、`getCurrentUserId`、`middleware`／`proxy` 的旗標、用的是 anon 還是 service role key，再下結論。有登入頁不代表有人在用。
- 規則：結論若會讓使用者「去做某件事」（登入、設定、跑 SQL），先確認那件事在對方環境裡真的做得到（例如帳號存在）。
