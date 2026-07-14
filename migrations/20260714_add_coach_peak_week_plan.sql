-- 教練自訂 Peak Week 逐日課表
--
-- 為什麼需要：通用引擎只能算「公式版」peak week（依體重/性別/基因），但 peak week 是
-- 全備賽流程裡最吃教練個人判斷的一段：
--   · 這個學員實測灌多少碳才圓滿（公式算不出來，只有做過才知道）
--   · 要用哪種節奏（Helms Table 7.1：峰值在賽前 2 天；也有人放賽前 1 天）
--   · 他的「low」是碳循環（訓練日/休息日不同）還是單一值
--   · 賽前那幾天要不要照常訓練、哪天拍基準照、哪天做視覺判讀
-- 這些引擎都算不出來 → 教練只能用紙本/手動改 DB，系統就賣不出去。
--
-- 行為：有這張課表時，引擎照常產生通用計畫，然後用課表**逐日覆寫**（教練值優先；
--       沒填的欄位 fallback 引擎值）。沒有課表 → 完全照舊，行為不變。
--       呼應 CLAUDE.md 紅線 3「教練設定優先於引擎」。
--
-- shape:
-- {
--   "days": [
--     { "date": "2026-07-23", "label": "Low · 訓練日", "carbs": 236, "protein": 186, "fat": 50,
--       "water": 3200, "sodiumMg": 3000, "trainingNote": "最後一次較重的訓練",
--       "foodNote": "...", "note": "拍基準照" }
--   ],
--   "authoredAt": "2026-07-14T12:00:00Z",
--   "authorNote": "依 Helms Ch.7 節奏，峰值放賽前 2 天"
-- }
-- days[].date 以外全部選填；只有填了的欄位才覆寫引擎值。

ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_peak_week_plan JSONB DEFAULT NULL;

COMMENT ON COLUMN clients.coach_peak_week_plan IS
  '教練自訂 Peak Week 逐日課表。{ days: [{ date(必填), label?, carbs?, protein?, fat?, water?, sodiumMg?, trainingNote?, foodNote?, note? }], authoredAt, authorNote? }。存在時逐日覆寫引擎產生的 peakWeekPlan（教練值優先，未填欄位 fallback 引擎值）；null = 完全照引擎公式。';
