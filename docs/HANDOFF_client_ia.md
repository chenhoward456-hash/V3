# V3 學員頁 IA 交接簡報（給 Fable 建新東西用）

> 用途：Howard 要換去 Fable 建新功能，這份給 Fable 一個乾淨 context 快速上手學員頁的資訊架構（IA）與地雷。
> 產生時間：2026-07-10。動手前務必再讀 `~/V3/CLAUDE.md` 紅線 + `DESIGN.md`。

## 專案座標
- Repo：`~/V3`（Next.js App Router）
- DB：Supabase（**production，真實學員資料，沒有 staging**）
- 學員頁主檔：`app/c/[clientId]/page.tsx`（~2400 行，路由 `/c/{unique_code}`，免登入）
- 本次工作分支：`refactor/goaldriven-plan-progress-split`（剛推，未合 main）
- 測試員：陳胤豪備賽檔，code `nfV43jIV`

## 學員頁分頁骨架
`page.tsx` 用 `view` state 切換，底部 `components/client/BottomNav.tsx` 導覽。

| label | tab key（陷阱：名不符實） | 主要內容 / section 元件 |
|---|---|---|
| 🎯 今日 | `home` | TodayHeadline、MyPlanSection、打卡卡片、ProgressJourney |
| 📈 進度 | **`data`** | DayBasedCards + **SeeTabSection**（內含 分析/工具 子分頁） |
| 📋 計畫 | **`training`** | 飲食紀錄/NutritionLog、補品策略、訓練課表（一串 CollapsibleSection） |
| 🩺 健康 | `lab` | HealthScoreBanner、感受趨勢、血檢 |
| ☰ 更多 | `more` | 其他 |

⚠️ 「進度」的 key 是 `data`、「計畫」的 key 是 `training`——別被騙。

## 剛做完的：GoalDrivenStatus 拆分（沿用這個 pattern）
`components/client/GoalDrivenStatus.tsx` 加了 `section?: 'plan' | 'progress' | 'all'` prop，一顆元件渲染兩種半：
- `section="progress"` → 進度分頁（在 `SeeTabSection.tsx`）：目標體重計畫核心數據(上台推算)/Peak Week 拆分/代謝壓力/預測/EA/月經/warnings
- `section="plan"` → 計畫分頁（在 `page.tsx` `view==='training'` 備賽客戶）：新卡「🍽️ 今日營養處方」= 今日飲食目標/分餐蛋白/活動量/血檢建議/血檢複檢
- 同一元件在兩分頁各渲染一次都餵 `initialData`（頁層 `nutritionEngineSuggestion`），所以不重複 fetch；plan 那顆的 fetch 刻意不帶 `autoApply`（鏡像顯示，不寫 DB，套用由進度實例／頁層 `runEngine` 負責）。

## 動這塊必守的紅線
1. **改 UI 後一定起 dev server 用瀏覽器實際看**（`npm run dev` :3000，測試 code `nfV43jIV`），不要只靠讀 code 推理渲染結果。
2. **push 前必先 `npx tsc --noEmit`**（已有 pre-commit hook 擋），別拿 Vercel deploy 當測試迴圈。
3. **改 macros/引擎前**：`coach_macro_override` 存在時任何引擎不可覆寫 macros；自動調整前查 `auto_adjust_enabled`；macro 變更寫 `macro_adjustment_log`。
4. **血檢狀態真相在 `utils/labStatus.ts` 的 `calculateLabStatus()`**，不是 DB 的 `lab_results.status`。
5. **共用常數改前先 grep 全 repo**：LAB_THRESHOLDS（`utils/labStatus.ts`）、血檢 CATEGORIES、client mode 邏輯（`lib/client-mode.ts`，要跟 DB trigger `trg_sync_client_mode` 一致）。
6. **顏色只做語意**：藍=品牌/互動，紅黃綠=血檢/訓練狀態（嚴禁裝飾），其餘中性灰；卡片統一 `bg-white border border-slate-200 rounded-2xl p-5`；未經 Howard 同意不要偏離 `DESIGN.md`。
7. **寫學員資料（clients 及關聯表 INSERT/UPDATE/DELETE）前先跟 Howard 確認**（刪 clients 會 CASCADE 刪光）；SELECT 隨意。動 DB 前先讀 `docs/SCHEMA.md`。

## 還開著的線頭
- 備賽 **GoalSettings（目標設定）** 還留在進度分頁，沒搬到計畫分頁（它是 GoalDrivenStatus 的鄰居、不是它的一部分，本次刻意沒擴範圍）。
- 本次分支 `refactor/goaldriven-plan-progress-split` 未合 main。

## 本地驗證速查
- 起 server：`cd ~/V3 && npm run dev`（:3000）。改 .tsx 後 HMR 常慢一拍，瀏覽器要重新 navigate 等幾秒才是新編譯。
- 學員頁：`http://localhost:3000/c/nfV43jIV`
- 教練後台 `/admin` 需自簽 `admin_session` cookie（見 `lib/auth-middleware.ts` `createAdminSession`）。
