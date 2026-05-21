# Longevity Tier W1 — 血檢時間軸 + 功能醫學儀表板

> 本檔案是 W1 的執行手冊與 handoff 文件。新 Claude session 可從這份直接接手。

## 產品定位（鎖定）

**Howard Protocol Longevity Tier** = 台灣第一個把「功能醫學風格的連續追蹤 + 個人化 protocol」做成訂閱制的健身教練系統。

- 價格：**NT$4,999/月**（介於 coached 2,999 和未來 concierge 12,000 之間，先不衝 1 萬）
- 客群：30-55 歲，想要連續追蹤健檢數據、有 protocol 的人
- 差異化：**功能醫學 optimal range**（ApoB <80 / hsCRP <1 / 空腹胰島素 <5 / Vit D 50-100）vs 一般醫院 normal range
- 不做：Whoop / Oura / Garmin（台灣覆蓋率太低）
- 暫緩：功能醫學醫師合作（之後升級 concierge 才需要）

## 現況盤點（V3 已有）

| 模組 | 路徑 | 狀態 |
|---|---|---|
| 功能醫學 optimal range 規則引擎 | `utils/labStatus.ts` (333 行) | ✅ 完整 |
| 血檢編輯器 | `app/c/[clientId]/components/LabResultEditor.tsx` | ✅ |
| 單一指標趨勢圖 | `app/c/[clientId]/components/LabResultTrendChart.tsx` (171 行) | ✅ 有 recharts |
| 血檢清單 | `components/client/LabResults.tsx` (475 行) | ✅ |
| Health Report | `components/client/HealthReport.tsx` (156 行) | ✅ |
| Lab API | `app/api/lab-results/route.ts` | ✅ |
| `lab_results` schema | `supabase-schema.sql:17-27` | ✅ |
| `daily_wellness` 含 HRV/RHR/睡眠 | `supabase-schema.sql:387-401` | ✅ |
| `subscription_tier` enum | `free/self_managed/coached` | ⚠️ 需加 `protocol` |
| 健康模式 flag | `health_mode_enabled` | ⚠️ 半成品 |
| Garmin OAuth | `garmin_connections`, `garmin_oauth_states` | ❌ 死碼（官方 API 沒過）|

## W1 缺口（要做的事）

### D1 — Migration（✅ 已完成）
- 檔案：`migrations/20260520_longevity_w1_lab_interpretation.sql`
- 新增：
  - `lab_results.coach_interpretation TEXT` — 單一指標解讀
  - `lab_panel_notes` 表 — 整組血檢綜合解讀（client_id + panel_date unique）
- **記得跑 migration**：到 Supabase SQL Editor 貼上執行

### D2 — `/health/timeline` 總覽頁面（✅ 已完成）
- 檔案：`app/c/[clientId]/health/timeline/page.tsx`
- 路徑：`/c/{unique_code}/health/timeline`
- 內容：
  - 摘要列（追蹤項目 / 正常 / 注意 / 警示 / 最佳）
  - 6 個功能醫學分類（代謝 / 心血管 / 發炎 / 肝腎 / 甲狀腺荷爾蒙 / 微量營養素）
  - 每指標 1 張小卡：狀態燈、最新值、趨勢箭頭+變化%、迷你 sparkline、Howard 標準、筆數
  - 「最佳」徽章（達 `LAB_OPTIMAL_RANGES`）
  - 教育性說明：為什麼 Howard 標準 ≠ 醫院標準
- 用 `useClientData` hook 拉資料，重用 `calculateLabStatus / isInOptimalRange / getOptimalRangeText`
- TypeScript 通過 ✅

### D3 — TrendChart 加功能醫學 optimal range overlay（✅ 已完成）
- 修改：`app/c/[clientId]/components/LabResultTrendChart.tsx`
- 新增功能：
  - 範圍型指標（TSH / 鐵蛋白 / 維生素D 等）：畫淡綠 `<ReferenceArea>` 表示醫院正常範圍
  - 單一閾值指標：畫綠線（正常上限）+ 粉線（警示上限）
  - **Howard 標準**：深綠 emerald 線（單值）或深綠帶狀（範圍）— 標籤 "Howard 最佳 / Howard 標準"
  - 性別差異變體自動對應（FEMALE_VARIANTS）
- 新增 prop：`gender?: '男性' | '女性'`（向後相容）

### D4 — 教練後台血檢解讀編輯（✅ 已完成）
- **單一指標解讀**：
  - 修改 `app/admin/clients/[clientId]/page.tsx` 的 LabResult 介面 + UI
  - 每筆 lab 加「🔬 教練解讀（Longevity Protocol）」綠底 textarea，寫入 `coach_interpretation`
  - 修正 admin API 白名單 bug：`custom_advice / custom_target / coach_interpretation` 過去都被白名單過濾掉沒存（`app/api/admin/clients/route.ts`）
  - `/api/lab-results` POST/PUT 也加上 `coachInterpretation` 欄位
- **整組血檢綜合解讀**：
  - 新 API：`app/api/lab-panel-notes/route.ts`（GET 公開 / PUT/DELETE 需教練權限，upsert by `client_id + panel_date`）
  - 新元件：`app/admin/clients/[clientId]/components/LabPanelNotesEditor.tsx`
    - 自動從 `lab_results` 萃取所有 unique panel_date
    - 每個 date 一個卡片：綜合解讀 / 優先處理 / 下次追蹤日期 + 獨立儲存按鈕
  - 已掛到 admin 血檢 tab 底部
- **學員端時間軸頁面同步顯示解讀**：
  - 修改 `app/c/[clientId]/health/timeline/page.tsx`
  - 在摘要列下方新增「Howard 的解讀」區塊，顯示最新 3 筆 panel notes（綜合解讀 + 優先處理 + 下次追蹤）
  - 這是 NT$4,999 客戶登入第一眼會看到的東西 — 銷售腳本的具象化

### D5 — Polish + Demo（✅ 已完成）
- **主頁入口**：在 `app/c/[clientId]/page.tsx` 血檢區塊下方加綠色 CTA banner 連結到 `/health/timeline`（只在 `lab_enabled && lab_results.length > 0` 時顯示）
- **修 lint warning**：`labs` 包進 `useMemo` 避免 useMemo 依賴每 render 變化
- **build 通過**：`/c/[clientId]/health/timeline` 6.16kB ✅，無 type error
- **Migration 已跑進 Supabase**：用 MCP `apply_migration`，驗證 `coach_interpretation` 欄位 + `lab_panel_notes` 表存在
- **API smoke test**：`/api/lab-panel-notes?clientId=...` ✅ 200, `/api/lab-results` ✅ 回傳 `coach_interpretation: null`, `/c/.../health/timeline` ✅ 200
- **Demo 腳本**：`LONGEVITY_W1_DEMO_SCRIPT.md` — 2 分鐘逐句腳本 + 錄影 checklist + 給研究對象的開場訊息

## 後續週次（11 週剩餘）

| 週 | 任務 |
|---|---|
| W2 | Supplement protocol 版本化 + 歷史檢視 |
| W3 | AI 教練 mode-aware（健康模式 vs 備賽模式不同 prompt）|
| W4 | 健康模式儀表板（學員端）+ 教練後台分流（把 `health_mode_enabled` 做完）|
| W5 | Apple HealthKit via Shortcuts ingest（`/api/health/ingest`）|
| W6 | Health Score 算法（血檢 + wearable + 主觀加權）|
| W7 | Protocol tier 加 `subscription_tier` + landing page |
| W8 | Onboarding flow + 手動輸入 fallback |
| W9 | 找 3 個 beta 客戶（45+ 研究對象，首月 NT$2,500 半價）|
| W10 | Onboard + 每週訪談 |
| W11 | 根據回饋調整 |
| W12 | Protocol tier 對外開放，限收 5 人 |

## 平行任務（即刻開始，不等 W9）

- **物色研究對象**：你身邊 45-60 歲、有健檢報告、願意聊的人。目標：12 週累積 3-5 人深度訪談
- **找功能醫學醫師**：先不合作，但開始建立關係。為 6-12 個月後的 concierge tier 鋪路

## 開放決策（之後要回來決定）

1. Apple HealthKit ingest 走哪條路：Shortcuts (免費) vs Health Auto Export App (US$5)？傾向 A+B 都做，學員選
2. HealthKit workouts 要不要灌進 `training_logs`？目前傾向不灌，避免污染現有教練後台
3. `lab_results` 的 `panel_id` 設計：現在用 `panel_date` 當 key 已足夠，未來如果同一天驗多次再加 explicit panel_id

## 重要對話脈絡（避免遺失）

- Howard 26 歲、CSCS、目前自己在備賽，**不是 longevity 客戶本人** → 必須找 45+ 研究對象避免閉門造車
- V3 是備賽腦設計的，longevity 是哲學對立面（不接受短期 trade-off）
- 「功能醫學連續追蹤」比「longevity」更好賣 — 台灣 40 歲老闆聽得懂
- 1 萬定價現在 hold 不住（沒 MD、沒高接觸服務），4,999 是真實能交付的價位
- Garmin 官方 API 沒過，死碼留著未來跑 `python-garminconnect` 非官方爬蟲
