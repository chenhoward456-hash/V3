# 教練處理工作區：Claude 交接

分支 `codex/coach-workflow`，基底 `main` 的 `c501595`（PR #222 已合）。本輪先做「晨報 → 優先清單 → 個別學員 → 既有處理入口」，未改營養引擎、學員處方或 DB schema，沒有新增推播排程。

## 接手方式

1. 在獨立工作區開啟這個分支；本機工作區為 `~/V3-coach-workflow`。不要直接覆蓋 `~/V3` 裡其他 session 的修改。
2. 先讀本文件、原專案 `~/V3/AGENTS.md`、`DESIGN.md`，再看與 `origin/main` 的差異。
3. 重點審核：排序是否符合教練使用方式、近期結果的資訊語義、資料讀取是否完整，以及訊息文案。不改既有臨床閾值來配合畫面。
4. 本地驗證與 CI 通過後，由 Claude 完成 PR 審核及合併。本輪交付 draft PR，尚未合併。

## 每天怎麼用

- LINE 晨報與 `/admin` 顯示同一份清單的前三位，一人多個理由合併；其他學員收合。
- 點「查證與處理」進總覽，先看原因、下一步與日期，再看上次教練訊息和營養調整。
- 「發訊息」「記處理備註」接回原有功能；「查看／設定複核」進該學員原有健康頁，並非新增通用約訪功能。
- 待審提案連到 `/admin?proposalClientId={id}#coach-proposals-{id}`，直接展開該學員的原有待審提案，暫時收起首頁一般摘要，另有返回完整清單入口，使用原有「套用／不要」。
- 原有晨報預覽、管理摘要、設定檢查收進首頁「其他管理摘要」；原有圖表和操作保留，總覽快速操作移到工作區下方。

## 同一個資料出口

`loadCoachDigest(supabase, { today, adminUrl })` 回傳 `workflow: CoachWorkItem[]`。
晨報、`GET /api/admin/coach-workflow`、首頁及單學員面板共用這個陣列。
`today` 以台灣日期 `YYYY-MM-DD` 計算。

- `lib/coach-workflow.ts`：純函式 `buildCoachWorkflow`，沿用 `readSignals`，合併理由並排序。
- `lib/coach-digest.ts`：讀取已有資料組成清單與晨報。
- `app/api/admin/coach-workflow/route.ts`：管理員驗證，選填 `clientId`（UUID），本人歷史限制 `client_id`。
- `components/admin/CoachWorkflowPanel.tsx`：顯示、重試與導航；成功沿既有路徑發訊息／存備註後重新載入。

`CoachWorkItem` 包含 `clientId,name,priority,reason,action,review:{date,label},href,reasons,signals,latestMessage:{sentAt,readAt}|null`。
`CoachWorkReason.kind` 為 `signal|offline|lab|proposal|result`。

排序只是人工處理順序：不舒服100、逾期回檢／重測90、筆記疑問80、3–30天掉線70、回來前空窗65、補償擺盪60、水分跳升／蛋白質50、近期回檢45、提案40、近期結果資訊20。非緊急 sev1 訊號保留明細，不單獨製造任務。

## 日期、通知與完成狀態

- 沒有既有複核日期時顯示未設定，不杜撰明天或一週後。
- 血檢回檢／預測重測使用已有日期；已產出結果使用 `resultDate`，身體實驗使用 `end_date`，畫面標為資料日期。
- 結果只列近31天，priority20，顯示「可查看；系統未記錄是否已複核」。它是近期資訊，並非未完成任務；超出窗口也不代表完成。
- 通知 helper 新增向後相容選項 `includeNotified`、`throwOnReadError`。預設的通知去重保持原樣；工作清單另外讀包含已通知的結果，避免晨報發完就讓後台結果消失。
- `coach_messages.read_at` 代表訊息卡收起，只能標「已收起」，不等於閱讀理解、照做或完成。
- 沒有新的任務完成欄位／按鈕。備註不是自動結案，訊號仍由既有資料計算。
- 最近訊息按每個活躍學員查最新一筆，沒有31天限制，也避免全表筆數上限遮掉別人的舊訊息。

## 只讀與失敗處理

新 GET 不呼叫 cron、send、sweep 或 nutrition-suggestions。主清單與結果證據讀取出錯會回500，不能把錯誤呈現為空清單。

單人歷史取最近三筆 `coach_messages`（`created_at`）與 `macro_adjustment_log`（`applied_at`）。任一讀取失敗會回 `history.unavailable=true`，保留可讀資料並顯示部分紀錄載入失敗。

原總覽的 `GET /api/client-overview` 和 `GET /api/nutrition-suggestions` 有既有寫入副作用；本輪未改它們。所有本地瀏覽器 QA 把 API 換成假資料，禁止任何非 GET／HEAD 請求，並封鎖 service worker。不要用真 Supabase 測試開頁來假設沒有寫入。

## 安全重跑瀏覽器驗證

先在另一個終端啟動假環境 dev server：

```sh
env SESSION_SECRET=coach-workflow-local-fixture-secret ADMIN_PASSWORD=local-fixture NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-fixture SUPABASE_SERVICE_ROLE_KEY=local-fixture npm run dev -- --port 3011
```

`scripts/verify-coach-workflow.js` 只接受 localhost，合成 session 與全部學員資料。需可用的 `playwright-core` 與 Chromium；可用 `PLAYWRIGHT_MODULE` 指向模組路徑、`CHROMIUM_PATH` 指向瀏覽器。沒有安裝時可在一次性工作區安裝 `playwright-core`，不要改正式專案依賴。

```sh
node scripts/verify-coach-workflow.js http://localhost:3011 /tmp/coach-workflow-qa
# 其他情境：empty、read、error、single
HOWARD_QA_SCENARIO=error node scripts/verify-coach-workflow.js http://localhost:3011 /tmp/coach-workflow-qa-error
```

腳本驗證430／1280寬度、前三位／其他、理由、個人入口、訊息開關、備註位置、待審區塊展開與按鈕。禁止點套用／發送／儲存。每次輸出假資料截圖及 `qa-log.json`；瀏覽器錯誤、未攔截API或非GET請求會使腳本失敗。

## 驗證結果與界線

詳見 [本地 QA 紀錄](qa/coach-workflow/README.md)。單元測試與瀏覽器驗證皆使用假資料。
本輪沒有驗證真實學員收到訊息後的執行循環，也沒有直接寫入正式資料。合併後若檢查 live 資料，需遵守專案對學員資料寫入的確認規則。

既有批次查詢仍受 Supabase 預設筆數上限影響；若未來學員／歷史量增加，需另做分頁或聚合。不是本輪已解決的項目。
