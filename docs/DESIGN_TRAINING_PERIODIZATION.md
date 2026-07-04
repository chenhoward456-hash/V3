# 設計稿：訓練週期化 + Autoregulation（按當日/當週狀態調量）

> 狀態：**提案，未動 code**。給 Howard 拍板用。2026-07-04。
> 依據：CLAUDE.md 紅線、DESIGN.md、記憶 project_v3_training_progress / training_templates / comp_bodyfat_measurement（延伸鐵則）/ engine_routing。

---

## 1. 問題定義：訓練端現在有什麼、缺什麼

### 現在有的

| 能力 | 位置 | 性質 |
|---|---|---|
| 靜態週課表（教練貼文字→解析成 JSON） | `clients.training_plan` (JSONB)；編輯器 `app/admin/clients/[clientId]/page.tsx:657`（parse）/ `:741`（serialize）/ `:2224`（UI） | 固定 dayOfWeek→動作清單，**沒有「週」的概念**——第 1 週和第 12 週長一樣 |
| 學員端今日課表卡 | `components/client/TodayWorkout.tsx:27-38`（取今日）/ `:66-102`（表格） | 純呈現，永遠顯示課表原始組數/RPE |
| 公版課表庫 | `training_templates`（套用 = COPY plan_json，非 reference；目前無 UI，手動 SQL） | schema 同 training_plan |
| 每日恢復判決（單一聲音） | `components/client/RecoveryDashboard.tsx:202-208`（🟢🟡🟠🔴 一句話 + 訓練處方）；引擎 `lib/recovery-engine.ts:846` | 輸入=手填 wellness 為主，ACWR 只在 opt-in 展開區（`RecoveryDashboard.tsx:355`） |
| 當日訓練模式建議（既有的 autoregulation 雛形） | `lib/training-mode-engine.ts:425`（加權投票，含 deload 模式 `:148`）；API `app/api/training-readiness/route.ts:276-290`；UI `components/client/TrainingLog.tsx:606-669` | ⚠️ 吃 training_logs 的 RPE/組數（髒資料）+ ACWR；且它的 `weeksSinceLastDeload`（`training-mode-engine.ts:226`, 投票在 `:802-813`）是從髒 log「推斷」上次 deload，不是從計畫知道 |
| 進步追蹤 | `lib/training-progress.ts:128` `computeTrainingProgress()`；週報停滯推播 `app/api/cron/weekly/route.ts:477` | 已知資料髒（重量常不填、動作亂換） |

### 缺的（這次要補的洞）

1. **課表沒有時間軸**：沒有 mesocycle（週期塊，例如「4 週漸進 + 1 週 deload」）概念。deload 只存在於「當日模式建議」的被動投票裡，教練無法「排」一個 deload 週，學員也不知道自己在週期的第幾週。
2. **課表跟建議會互相矛盾**：TodayWorkout 顯示課表原文（RPE 9），同一頁 RecoveryDashboard 可能說「今天降量」、TrainingLog 的模式卡可能說「deload」——三個地方各講各的。
3. **既有 autoregulation 建在髒訊號上**：mode 引擎重度依賴 training_logs 的 RPE/連續訓練天數/ACWR，違反 2026-06-19 延伸鐵則（訓練 log 髒，不可疊精準分析）。
4. **教練端沒有週期工具**：改課表 = 重貼整份文字。備賽學員從「增肌塊」切「減脂塊」全靠教練記在腦裡。

---

## 1.5 設計前提修正（2026-07-04 Howard 定調，蓋過下面任何與之矛盾的描述）

> ⚖️ 立場檔性質：這是 Howard 的教練實務，隨他變深可再改。

- **「週期」的本體＝動作選擇的改變，不是重量公式的波動。** 增肌塊＝三大項＋硬舉做神經適應（重量重）；減脂後期＝轉啞鈴/器械為主。換塊＝換一份 plan_json（公版庫 training_templates 就是這個用途）。
- **重量調整只發生在主項（每天的第一個動作）**，且屬教練在當下塊裡的臨場拿捏——系統不建模、不指揮，只做時間軸記帳＋提醒。
- **不得內建「減脂＝比較虛」假設**：Howard 減脂時狀態常比增肌好。疲勞旗標必須用個人相對基線（本設計已是），禁用絕對值閾值。
- 由此，系統職責收斂成三件：①時間軸（第幾週/何時結束/續排提醒）②塊身分標籤（增肌/減脂前期/減脂後期）③減量週標記。方案 C（自動調重量）永久出局。

---

## 2. 方案

### 共同的資料模型基礎（三案共用）

`plan_json` 加**選配** `mesocycle` 欄位。無 DB migration——`clients.training_plan` 與 `training_templates.plan_json` 都是 JSONB，且 invariant 檢查用 `z.looseObject`（`lib/invariant-checks.ts:53-60`），多鍵不會炸。舊課表沒這欄 → 功能靜默關閉，零回溯風險。

```json
{
  "name": "...", "days": [...], "cardio": {...},
  "mesocycle": {
    "startDate": "2026-07-07",   // 週期起始（週一）；公版 COPY 時不帶，套用當下才填
    "weeks": 5,                   // 一輪幾週
    "deloadWeek": 5,              // 第幾週是 deload
    "blockLabel": "減脂後期",     // 塊身分標籤（增肌/減脂前期/減脂後期…自由字串）——1.5 節：塊的身分由動作選擇定義，這裡只記名字
    "note": "轉啞鈴器械為主"      // 選填
  }
}
```

新純函式庫 `lib/periodization.ts`（跟 `lib/training-progress.ts` 同風格，純函式 + vitest）：
- `getCycleState(plan, todayTaipei)` → `{ week: 3, totalWeeks: 5, isDeloadWeek: false } | null`（沒 mesocycle 回 null）
- `applyDeloadToDay(day)` → deload 週的顯示調整。**2026-07-04 修正（1.5 節）：只動主項（exercises[0]）**——RPE 上限 6、組數減 1–2；附屬動作照舊或減 1 組（幅度需 Howard 微調）。~~原案全表組數 ×0.5~~ 收回：全表砍半是教科書公式，Howard 實務上重量拿捏只在主項。`training-mode-engine.ts:148` MODE_CONFIG.deload 的 -50% 定義之後要跟這裡對齊成單一真相。
- 時區一律 Asia/Taipei，跟 `TodayWorkout.tsx:16-25` 同算法。

公版 COPY 語義不變：template 的 mesocycle 只帶 `weeks`/`deloadWeek`（相對值），`startDate` 在套用學員時才填——COPY 後各學員時間軸獨立，母版改不影響已套用者。

---

### 方案 A：最小可行——「日曆週期化」，零 autoregulation 新訊號

**只做**：課表知道自己在第幾週、deload 週自動換算顯示。不加任何新判斷引擎。

- **資料模型**：上述 mesocycle 欄。
- **引擎接點**：
  - `lib/periodization.ts`（新檔，純日曆計算，不碰任何 log）。
  - `app/api/training-readiness/route.ts:260-292`：算 `planTotalSets` 時，deload 週改用調整後組數，讓既有模式建議的「建議組數」不跟課表打架。
- **UI 接點**：
  - `components/client/TodayWorkout.tsx:40-63`（header）：加「第 3 週 / 共 5 週」中性灰小字；deload 週顯示「🔄 本週減量週」＋表格組數/RPE 換成調整值、原值劃線淡化。深色整片底禁用，照 DESIGN.md 中性卡+小標籤。
  - `app/admin/clients/[clientId]/page.tsx:2224` 編輯器：文字格式加一行「週期：7/7 起 5 週，第 5 週減量」；`:657` parser / `:741` serializer 各加一條規則；`:2290` 預覽區顯示週期狀態。
- **優點**：一週內可完成、零髒資料依賴（純日曆）、教練立刻有「排 deload」的工具。
- **缺點**：沒有「身體狀態不好 → 提前 deload」的 autoregulation；週期到底教練要記得續排（可在週報提醒）。

### 方案 B（推薦）：A + 可靠訊號疲勞旗標，教練批准制 deload

**A 全做**，再加一條**只用可靠資料**的 autoregulation 迴路：

- **輸入訊號（白名單，僅此二者）**：
  1. **手填 wellness 基線偏移**：近 7 天 sleep_quality/energy_level/training_drive 均值 vs 前 30 天基線（資料源同 `app/api/recovery-assessment/route.ts:44-49`，全是每日手填 1–5 分）。
  2. **體重速率異常**（僅 cut/備賽學員）：body_composition 天天量的體重，14 天窗掉速 >1.5%/週（沿用 CutHealthCard 已拍板的閾值分級）。
  - **明確排除**：HRV/穿戴（wearableInsightCard 已停用）、training_logs 的 RPE/重量/ACWR（髒）。
- **引擎接點**：
  - `lib/periodization.ts` 加 `computeFatigueFlag(wellness30d, weights14d, goalType)` → `{ flagged, reasons, confidence } | null`（資料不足回 null，見防呆節）。
  - `app/api/cron/weekly/route.ts:477` 附近（停滯提醒同一個位置）：每週跑一次，`flagged && 距離排定 deload 還有 ≥2 週` → **寫 `coach_notifications` 通知教練**「胤豪連兩週精力低於基線，建議把 deload 提前到下週」。教練同意就去後台把 `deloadWeek` 改掉（就是改一個數字）。零新 CHECK constraint、零自動改課表——完全符合「教練設定優先於引擎」。
  - （進階選項，可後做）改用 `pending_proposals` 走批准流程——但 `proposal_type` CHECK 目前只有 macro_adjustment/cardio_change/personal_note/retest_request（docs/SCHEMA.md），要 migration 加 `training_adjustment`。MVP 不做。
- **UI 接點**：同 A，另加：
  - `components/client/TrainingLog.tsx:606-669` 模式建議卡：deload 週時讓位——顯示「本週是課表排定的減量週，照調整後課表練」，不再跑投票（消掉打架）。非 deload 週維持現狀（是否進一步降級見「需 Howard 決定」#6）。
  - `components/client/RecoveryDashboard.tsx:202-208` 判決卡：deload 週在 headline 下加一行灰字「本週為減量週，課表已自動調整」——**仍是同一個聲音**，只是讓它知道課表狀態。
- **優點**：autoregulation 只碰天天有、不會說謊的資料；建議只到教練耳朵，學員看到的永遠是「課表本身」（單一聲音）；migration 為零。
- **缺點**：多一條 cron 邏輯要維護；閾值需要 Howard 臨床拍板（見第 5 節）。

### 方案 C（不推薦，記錄備查）：逐週漸進 + 當日自動調整組數

plan_json v2 帶 per-week 組數/RPE 波型（week1 14 組 → week4 20 組），TodayWorkout 按 RecoveryDashboard 當日分數即時把組數乘上調整係數，自動漸進負荷。

**為什麼不推**：①漸進負荷要知道「上週實際做了多少」——訓練 log 髒，這個迴路會建立在謊言上；②學員本來就不照課表，逐日自動改課表 = 精準幻覺；③TodayWorkout 每天長不一樣，跟「課表是教練的話」的信任模型衝突；④編輯器複雜度爆炸。等訓練 log 品質有解再議。

---

## 3. 推薦：方案 B（A 是它的第一里程碑，可分兩次上）

理由：
1. **可靠訊號原則**：日曆（絕對可靠）+ 手填 wellness + 天天量體重，一個髒訊號都不碰。
2. **一個聲音**：學員面只有「課表」和「RecoveryDashboard」兩個既有表面，週期化是課表的屬性不是新卡片；疲勞旗標只給教練。
3. **教練優先**：引擎永不自動改 training_plan，只通知；Howard 保有全部臨床判斷權。
4. **成本**：零 migration、零新表、新增一個純函式庫 + 三處 UI 小改 + cron 一段。

實作順序：①`lib/periodization.ts` + tests → ②admin parser/serializer/預覽 → ③TodayWorkout 顯示 → ④TrainingLog deload 讓位 + readiness planTotalSets 對齊 → ⑤weekly cron 疲勞旗標。①–④ = 方案 A，可先上線給 Howard 用。

---

## 4. 風險與髒資料防呆

| 風險 | 防呆 |
|---|---|
| 學員不照課表練 | 週期進度純日曆推算，不依賴 log；deload 週顯示調整值但不強制（課表本來就標「參考」，`TodayWorkout.tsx:111-116`） |
| wellness 沒填 | `computeFatigueFlag` 門檻：近 7 天 ≥4 天有填、基線期 ≥10 天有填，否則回 null 不出旗標（沿用系統慣例：recovery-engine <5 筆 return null） |
| 體重量太少 | 14 天窗 <5 筆 → 體重訊號跳過，只剩 wellness 單訊號時 confidence 標 low、通知文案帶「訊號單一，僅供參考」 |
| 疲勞旗標誤報轟炸教練 | 只在 weekly cron 送（隨週報，不另外轟——沿用停滯提醒的決策）；同一學員 14 天冷卻 |
| mesocycle 過期（第 6 週了還是 5 週課表） | `getCycleState` 超過 totalWeeks → 顯示「週期已結束，等教練排下一塊」+ 週報提醒教練續排；不自動循環（要不要自動循環見決定 #1） |
| 舊課表 / 公版沒有 mesocycle | 選配欄位，null = 功能關閉，UI 完全不出現；invariant PlanSchema 是 looseObject 不會炸 |
| 時區 | 全部 Asia/Taipei，跟 `TodayWorkout.tsx:16` / `training-readiness/route.ts:262-266` 同算法，抽進 periodization lib 共用 |
| 模式建議卡與 deload 打架 | deload 週模式卡讓位（單一真相 = 課表）；`weeksSinceLastDeload` 髒推斷（`training-mode-engine.ts:802-813`）在有 mesocycle 時改吃日曆事實 |

---

## 5. 需 Howard 決定（每題含選項與我的傾向）

1. **週期模型用哪種？** ~~(b) 自動循環 (c) 線性漸進波型~~ → **2026-07-04 已定調 (a)**：極簡「N 週一輪 + 第 X 週 deload + 塊標籤」，週期結束手動排下一塊（通常＝換課表/套公版）。依據 1.5 節：模型在 Howard 腦裡，塊由動作選擇定義，系統只做呈現與提醒。
2. **疲勞旗標閾值？** wellness 三項 7 天均值低於個人 30 天基線多少算「疲勞」：(a) −0.5 分（1–5 制）連 2 週 (b) −0.75 分單週 ~~(c) 絕對值 <3.0~~（2026-07-04 出局：違反 1.5 節「禁用絕對值」）。**傾向 (a)**，但 0.5 這個數是我猜的，**臨床上多少算「該提前 deload」由你定**。
3. **deload 週的課表怎麼呈現？** → **2026-07-04 方向已定：只動主項**（RPE 上限 6、組數減 1–2），剩微調題：(a) 附屬動作照舊 (b) 附屬也各減 1 組。另一路線 (c) 教練每份課表自訂 deload 版天內容（加 `days_deload` 欄）之後可加。**傾向 (a)**——附屬本來就不是調重量的地方。
4. **疲勞旗標的動作強度？** (a) 只發 coach_notifications 通知你（**傾向**，零 migration） (b) 走 pending_proposals 批准流程（要 migration 加 CHECK 值） (c) 引擎直接改 deloadWeek（不建議，違反教練優先）。
5. **誰看得到週期資訊？** 現在課表卡只給 coached（`app/c/[clientId]/page.tsx:1509`）。(a) 跟隨現狀 coached only（**傾向**） (b) self_managed 顯示鎖定 upsell（模式卡已有先例 `TrainingLog.tsx:627-631`）。
6. **TrainingLog 裡的「訓練模式建議」卡去留？** 它吃 RPE/ACWR 髒訊號，跟「一個聲音」原則有張力。(a) 這次只做 deload 週讓位，其他不動（**傾向**，改動最小） (b) 整卡降級成只顯示 RecoveryDashboard 同源的一句話 (c) 移除。砍功能是品味題，你定。

---

## 附：關鍵接點索引（實作時的地圖）

- `lib/periodization.ts` — 新檔（純函式 + tests/lib/ 下的 vitest）
- `hooks/useClientData.ts:19-22` — TrainingPlan 型別加 `mesocycle?`
- `components/client/TodayWorkout.tsx:40-63, 66-102` — 週期 badge + deload 換算顯示
- `app/admin/clients/[clientId]/page.tsx:657, 741, 2224, 2290` — 編輯器 parse/serialize/UI/預覽
- `components/client/TrainingLog.tsx:606-669` — 模式卡 deload 讓位
- `app/api/training-readiness/route.ts:260-292` — planTotalSets 用調整後組數；把日曆 deload 事實餵給 `lib/training-mode-engine.ts:802-813`
- `components/client/RecoveryDashboard.tsx:202-208` — 判決卡加「本週減量週」一行灰字
- `app/api/cron/weekly/route.ts:477` 附近 — 疲勞旗標 + 週期續排提醒（隨週報）
- `lib/invariant-checks.ts:53-90` — （選配）PlanSchema 加 mesocycle 形狀檢查
