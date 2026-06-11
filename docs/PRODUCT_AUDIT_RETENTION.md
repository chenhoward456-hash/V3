# V3 產品稽核：讓人「想用 + 持續使用」

> 2026-06-11。六個面向平行深入稽核(新手啟動 / 每日回訪迴圈 / 血檢補品差異化 / 主動回訪 / 獲客轉換 / 進步感與爽點),全部讀真實 code、標 file:line。
> 目標單一:讓使用者第一次就想繼續用、且持續使用。不談商業策略。

---

## 一句話結論

**你不是做得不夠,是做得太多但沒「端出來」。**

系統的「腦」非常強——洞察引擎、血檢雙標準、補品引擎、備賽軌跡預測、體重回饋文案,水準都很高。問題是這些算出來的價值,使用者**看不到、被埋住、或根本沒接上線**。六個稽核全部指向這件事:

- 補品引擎(900 行,基因 × 血檢 × 文獻)的輸出,**只餵給 AI 聊天,從不渲染成學員看得到的卡片**。
- 個人化營養回饋的引擎,**整個 session 只跑一次**,使用者記完飲食/體重後不會重算,最強的「系統在幫我」回饋跟記錄動作脫鉤。
- 免費的 Web Push 推播管線**從頭到尾沒人訂閱**(只註冊了 service worker,沒有任何訂閱按鈕),所以最高頻的打卡提醒在 LINE 配額爆掉的此刻**一則都沒送出去**。
- 最有成就感的「本週 vs 上週,進步中 N 項」總覽卡(ProgressJourney),**被藏在第三層 tab**,主畫面看不到。
- 21 篇部落格的 CTA 文案寫「不用註冊直接看結果」,連結卻**全部指向註冊頁 `/join`**;真正零摩擦的 `/diagnosis` 反而被埋起來。

**好消息:這代表大部分修法是「接線」和「搬位置」,不是從零開發。** 難的邏輯都寫好了。這是便宜得多的問題。

---

## 修法優先序(按 ROI)

### 🟢 Tier 0 — 今天就能上(極小改動,立即見效)

| # | 改動 | 檔案 | 工作量 | 為什麼 |
|---|---|---|---|---|
| 0-1 | Blog/首頁所有「免費診斷」CTA 從 `/join` 改到 `/diagnosis` | `components/ArticleCTA.tsx:60,107`、`StickyCTA.tsx:123`、`app/page.tsx:327,613,751` | 10 分 | 文案承諾「不用註冊」卻導到註冊頁。21 篇文章流量全落在高摩擦頁,這是 blog 零轉換最直接的原因 |
| 0-2 | ScrollReveal 預設可見(改 opacity 初始為 1) | `components/ScrollReveal.tsx:37-41` | 30 分 | 首頁中段一大塊空白(爬蟲/慢網路/SEO 都受影響),一個檔修好全站 |
| 0-3 | ProgressJourney 搬到主畫面頂部 | `app/c/[clientId]/page.tsx`(元件已存在於 `SeeTabSection.tsx:151`) | 1 時 | 最有成就感的「我整體在進步」卡,目前藏在第三層。搬到第一眼 = 投報最高的留存改動 |
| 0-4 | 拿掉進 dashboard 的第二次同意 modal(`/join` 已勾過就寫進 consent) | `app/api/subscribe/free-trial/route.ts` + `components/ConsentGate.tsx` | 小 | 註冊後第一印象是「又被攔一次勾條款」,最大進門摩擦,不損法律效力 |
| 0-5 | `/tools` 補 redirect 到 `/tools/tdee` | 新增 `app/tools/page.tsx` | 10 分 | 導覽連到 `/tools` 會 404 |

### 🟡 Tier 1 — 這週(中改動,解鎖整套系統)

| # | 改動 | 檔案 | 工作量 | 為什麼 |
|---|---|---|---|---|
| 1-1 | **補上 Web Push 訂閱 UI** | 學員 dashboard + `app/api/push/subscribe`(後端已就緒) | 0.5–1 天 | 解鎖目前完全沒送出的免費打卡提醒。不做這步,後面所有「改走 Web Push」都是空談 |
| 1-2 | 記錄後重跑引擎,讓個人化回饋即時刷新 | `app/c/[clientId]/page.tsx:532-537`(`autoNutritionTriggered` ref) | 半天 | 把「系統替我重算目標」這個最強回饋接回記錄動作 |
| 1-3 | **把補品引擎輸出渲染成學員可見卡片**(reason/evidence/triggerTests) | `app/c/[clientId]/page.tsx:1961`、`components/client/DailyCheckIn.tsx` | 1–1.5 天 | 你的核心差異化從「啞清單」變「基於我的血、有文獻的個人化策略」 |
| 1-4 | 新人 dashboard 第一天就給個人化即時回饋(取代「14 天後再來」) | `components/client/NewUserLanding.tsx:111-149` | 中 | 數字都現成(success 頁已算),把價值從第 14 天拉到第 1 分鐘 |
| 1-5 | 真實達標觸發慶祝(血檢進最佳區 / 體重破新低 / 里程碑) | `components/client/BodyComposition.tsx:331`、`LabResults.tsx:277`、`celebrate` keyframe 已存在 | 半天 | 最該放煙火的時刻目前零反應;這是最想截圖炫耀的點 |

### 🟠 Tier 2 — 接著(差異化護城河 + 質感)

| # | 改動 | 檔案 | 工作量 | 為什麼 |
|---|---|---|---|---|
| 2-1 | **補品 → 血檢結果回饋卡**(「補鐵 60 天,鐵蛋白 18→45」) | 新 API join `supplement_logs` + `lab_results`,渲染在 `health/timeline/page.tsx:822-920` | 2–3 天 | 把補品演進故事補上結局。其他平台給不出、且越用越多 = 真正的「越用越離不開」 |
| 2-2 | 飲食/訓練/wellness 記錄回饋向體重看齊 | `NutritionLog.tsx:136`、`TrainingLog.tsx:352-383`(加 PR 偵測)、`DailyWellness.tsx:156`(目前純黑洞) | 各半天 | 體重迴圈是滿分範本,其餘三項都是反高潮或黑洞 |
| 2-3 | 週/月報改 email、砍 LINE 全員推 | `weekly/route.ts:423`、`monthly/route.ts:90` | 1 天 | 立刻釋放每週/月各 5+ 則 LINE 額度給關鍵互動 |
| 2-4 | 去 AI slop:統一色彩 token、收斂藍紫漸層、修中文字體 | `GoalDrivenStatus.tsx`、`TodayOverviewCard.tsx`、`globals.css:27-32`(Playfair 對中文無效)、`tailwind.config.ts` 已有色票沒用 | 1 天 | 拉高「值 $499/月」的精緻感 |
| 2-5 | 首頁加真實學員前後對比/見證(Eddie 94→85kg 等) | `app/page.tsx:414-444` | 內容 1-2 時 + 前端 1 時 | 社會證明目前只有教練自己,陌生人要看到「像我這樣的人的成果」 |
| 2-6 | 主項重量常駐「PR 牆 / 進步曲線」 | 新卡,資料在 `trainingLogs.compound_weight` | 半天–1 天 | 健身最核心的爽點,目前只在 toast 閃一下就消失 |
| 2-7 | 單指標教練解讀寫入路徑(UI 已會渲染,缺 editor) | admin lab 編輯區 + `lab-results` PATCH | 1–2 天 | 讓每個血檢卡都能有「Howard 對這數字怎麼看」,填滿空著的差異化區塊 |
| 2-8 | 血檢趨勢升級多點回歸 + 跨指標 pattern | `lib/lab-trend-analyzer.ts` | 2–3 天 | 從「比上次差 10%」升級成「每月惡化、X 個月後跨線」+ 自動抓組合訊號 |

---

## 各面向重點(file:line 佐證)

### 1. 新手啟動
- **做得好**:`/join/success` 頁是最強 aha moment(confetti + 即時算營養目標 + 預估達標週數,`success/page.tsx:363-410`)。
- **斷檔**:一進 dashboard 先被第二次同意 modal 攔(`ConsentGate.tsx:71` z-[100]),接著 `NewUserLanding` 把價值推遲到 14 天後(`:151-173`),做完第一筆體重沒有下一步(`:72-85`),而最好的 onboarding 內容(OnboardingGuide/Checklist 的動態數字 + 慶祝)新人第一天反而看不到。

### 2. 每日回訪迴圈
- **滿分範本**:體重記錄的 `getWeightFeedback()`(`BodyComposition.tsx:33-192`)個人化、有趨勢、有慶祝。
- **黑洞**:wellness 記完只有一句罐頭 toast 且丟掉 server 回應(`DailyWellness.tsx:156,154`);飲食記完是反高潮(`NutritionLog.tsx:136`);訓練吞掉壞消息、無 PR(`TrainingLog.tsx:373`)。
- **結構問題**:引擎個人化回饋整個 session 只跑一次(`page.tsx:532-537`),記錄後不刷新。

### 3. 血檢 / 補品差異化(你的核心)
- **真的「只有這裡有」**:血檢雙標準(`labStatus.ts:18-176`)+ AI 草稿→教練審核→LINE 通知工作流(`lib/lab-draft-engine.ts`),競品難抄。
- **破最大的一層是補品**:引擎輸出只進 AI 聊天(`page.tsx:475→1961`),學員主畫面看到的是啞清單(`DailyCheckIn.tsx`);沒有任何「補品→血檢結果」回饋迴路(grep 全 repo 確認不存在)。
- **數據鎖定**:素材齊全(血檢史、補品演進史、五柱健康分)但「越用越有價值」沒呈現給使用者看。

### 4. 主動回訪
- **致命**:Web Push 整條管線是死的——`LayoutShell.tsx:14-19` 只註冊 SW,全 repo 沒有任何地方呼叫 `pushManager.subscribe()` 或 `POST /api/push/subscribe`,`push_subscriptions` 表永遠空 → 早晚打卡提醒實際上一則都沒送(配額爆時連 LINE fallback 都沒有)。
- **全是負向訊號**:所有推播都是「你缺東西/你卡住/快到期」,沒有任何「達標恭喜/新低/連續記錄」的正向鉤子。

### 5. 獲客轉換
- **首頁空白**:`ScrollReveal.tsx:34-44` 中段全部初始 `opacity:0`,靠 IntersectionObserver 才淡入,無 JS fallback。
- **CTA 錯配**:文案「不用註冊直接看結果」全連到註冊頁 `/join`(`ArticleCTA.tsx:60,107`、`StickyCTA.tsx:123`);最強鉤子 `/diagnosis` 沒導覽入口、首頁也沒主打。
- **社會證明薄弱**:首頁成果只有教練本人,沒有真人學員案例。

### 6. 進步感與爽點
- **腦很強**:每日洞察引擎(`TodayOverviewCard.tsx:67-227`)、血檢三段式藍標(`labStatus.ts:264`)、備賽軌跡預測線(`BodyComposition.tsx:786-799`)都是高水準。
- **被埋/冷掉**:ProgressJourney 藏第三層(`SeeTabSection.tsx:148-162`);celebrate 動畫只用在 onboarding,日常達標零慶祝;主項進步只在 toast 閃一下。
- **視覺 slop**:藍紫漸層濫用(10 處)、emoji + 彩色底卡色彩系統失控、Playfair 字體對中文無效(`globals.css:27-32`)、定義好的色票沒在主畫面用。

---

## 建議開搞順序

1. **先掃 Tier 0**(半天內全部可上):CTA 改連結、首頁不再空白、ProgressJourney 上主畫面、拿掉雙重同意、修 404。立即改善獲客 + 第一印象 + 成就感。
2. **再做 Tier 1 的 1-1、1-2、1-3**:這三個解鎖整套系統(推播管線活過來、回饋接回記錄、補品差異化端出來)。
3. **Tier 2 挑 2-1(補品→血檢回饋卡)當差異化主攻**,其餘按手感補。

Tier 0 + Tier 1 大多是接線/搬位置,難邏輯都寫好了。這份報告就是施工藍圖,確認後可直接開工。
