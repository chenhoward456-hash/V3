# 教練工作區本地驗證

2026-10-07；基底 main c501595。所有截圖與瀏覽器資料均為合成學員，未連正式 Supabase、未寄送訊息、未儲存學員資料。

## 執行結果

- `npx vitest run`：197檔／3,562項通過（原3,531項，加31項）。
- `TZ=UTC npx vitest run`：197檔／3,562項通過。
- 新功能定向測試：API10項、清單／資料讀取21項，均通過。包括本人歷史、未授權零查詢、錯誤不當空清單、通知去重不等於複核完成、舊訊息與結果證據讀取失敗。
- `npx tsc --noEmit`：通過。
- `npm run build`（Next webpack、假 Supabase）：通過，117個靜態頁產生完成。
- 全專案 ESLint：0 errors／173 warnings；後續變更檔再跑0 errors。大部分警告為原有 React Compiler 建議，新面板資料載入effect亦有1 warning。
- 瀏覽器五種情境，手機430／桌面1280：合計60項通過。完整斷言結果見 [results.json](results.json)。所有情境均無 pageerror、未知API、非GET／HEAD請求，無橫向溢出。

正常34項涵蓋前三位／其他、理由展開、正確學員頁、未設定日期、訊息卡狀態、複核入口、提案延遲載入後展開、本人提案與套用／不要按鈕、訊息開關、備註表單在視窗內。其餘為空清單6項、訊息已收起6項、錯誤與重試8項、單一理由不出現空明細6項。

獨立 source reviewer 原抓到4個問題，皆已修正：結果誤用通知去重、提案入口錯頁、舊訊息誤報不存在、提案讀取失敗回空清單。後續瀏覽器又抓到hash定位的時序問題，改成提案query模式，重跑34項全部通過；沒有把source推理當實畫驗收。

沒有測量程式碼覆蓋率百分比。沒有驗證正式學員收到訊息後的理解／執行循環；沒有通用任務完成欄位。近期結果顯示為資料資訊，不冒稱未完成。

## 前後對照

同一組合成資料，左為改前、右為改後，僅截首屏。

- [後台手機](admin-mobile-comparison.png)／[後台桌面](admin-desktop-comparison.png)
- [學員總覽手機](overview-mobile-comparison.png)／[學員總覽桌面](overview-desktop-comparison.png)
- [提案入口手機](proposal-mobile.png)／[提案入口桌面](proposal-desktop.png)

新面板先放原因、下一步、已有日期與處理入口；原有圖表、quick actions、晨報預覽與管理工具保留。手機總覽header允許換行；資料未完整或清單載入失敗時有明確提示與重試。

重跑方法見 [交接文件](../../COACH_WORKFLOW_HANDOFF.md#安全重跑瀏覽器驗證)，使用 `scripts/verify-coach-workflow.js`。不得把瀏覽器測試改成直接呼叫正式API。
