# kakeibo v1 todo

Plan: docs/superpowers/plans/2026-10-29-kakeibo-v1.md

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Task 4
- [ ] Task 5
- [ ] Task 6
- [ ] Task 7
- [ ] Task 8
- [ ] Task 9
- [ ] Task 10
- [ ] Task 11
- [ ] Task 12
- [ ] Task 13
- [ ] Task 14
- [ ] Task 15
- [ ] Task 16
- [ ] Task 17
- [ ] Task 18

## 2026-10-29 全站 critique 修正（branch design/critique-fixes）

來源：`.impeccable/critique/2026-10-28T18-50-11Z__whole-site.md`（22/40）。使用者選擇：併進新分類、全部 5 項、預算與對帳帳本化。

- [x] P0 預算與實際脫節：`buildToday` 新增 `unbudgeted`；首頁與見開き預算表標出「未設預算」；預算頁列出本月有支出的科目
- [x] P1 科目選單：「常用」不再重複列在主分類下；注意列可直接開啟已填好科目與摘要的記一筆
- [x] P1 注意列：重複／未歸類／異常連到該日明細；籤上寫「需處理／待確認」
- [x] P2 句中連結被 flex 拆散（Hint 包 span）、連結點擊區 44px、見開き預設「今日」、桌面只留一個 h1、全形英數顯示時折成半形
- [x] 預算頁帳本化（BudgetBook：就地改、離開欄位自動存）；對帳表帳本化（帳簿｜實際｜差額｜日期，點帳戶名稱選好帳戶）
- [x] 006a 盤點、006 科目合併已執行（2026-10-29，使用者 COMMIT）。真實 user 是 00000000-…；aaaaaaaa／bbbbbbbb 是 004／005 測試殘留。
- [ ] **待使用者執行** 007a_budget_current_month.sql（快照）→ 007_collapse_sub_budgets.sql（本月子科目預算加總成主分類預算；預設 ROLLBACK）。005 也還沒執行（科目改名／合併頁要等它）。
- 未採納：critique 的「點擊目標 38×23」（瀏覽器實測整格 46×44 皆可點，偵測器量到的是連結內框）、「dock 蓋住最後一條注意列」（捲到底實測沒有蓋住）、「帳戶預設未指定」（來自線上沒有帳戶，程式預設就是第一個帳戶）
