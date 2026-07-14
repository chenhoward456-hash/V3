-- 個人 Peak Week 實測檔案（賽後回填，下次備賽當基準）
--
-- 為什麼需要（Helms Ch.7 guideline #2）：
--   「記錄過去比賽與『練習充碳』的視覺變化和時間點，建立你自己的反應資料。」
--   充碳的有效範圍是 3–12 g/kg——**四倍差距**。公式永遠算不出「這個人灌多少會圓滿、
--   灌多少會 spill over」，只有實測知道。
--
-- 真實案例：Howard 7/12 練習賽灌 460g（5.75 g/kg）→ 晨重 +1kg、自覺圓滿。
--   引擎的通用公式會給 5.0 g/kg（400g）——不是錯，但不如他自己的實測準。
--   這筆資料如果沒被系統記住，下一場又要重猜一次。
--
-- ⚠️ 刻意「不」自動套用進引擎公式：
--   那等於用另一個寫死的數字取代舊的寫死數字（重蹈 9 g/kg 的覆轍）。
--   正確用法：① 讓「載入引擎草稿」用實測值當峰值 ② 把歷史攤在教練面前，教練決定。
--   引擎給草稿、教練給判斷——這條線不能破。
--
-- shape:
-- [
--   { "competitionDate": "2026-07-12", "competitionName": "台中議長盃（練習賽）",
--     "bodyWeight": 80, "peakCarbs": 460, "peakCarbsGPerKg": 5.75,
--     "peakDayOffset": 1,                      -- 峰值放在賽前幾天
--     "protocol": "back_load",                 -- back_load | front_load | mid_load
--     "visualResult": "full_hard",             -- flat（扁）| full_hard（飽而硬）| spilled（溢出）
--     "weightDeltaKg": 1.0,                    -- 灌碳後晨重變化
--     "placement": "新秀第2 / 形體第5",
--     "notes": "…下次把峰值改放賽前 2 天，讓水分平衡" }
-- ]

ALTER TABLE clients ADD COLUMN IF NOT EXISTS peak_week_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clients.peak_week_history IS
  '個人 Peak Week 實測檔案（賽後回填，下次當基準）。[{ competitionDate, competitionName?, bodyWeight, peakCarbs, peakCarbsGPerKg?, peakDayOffset?, protocol?, visualResult(flat|full_hard|spilled), weightDeltaKg?, placement?, notes? }]。Helms guideline #2：用過去的視覺反應建立個人資料。⚠️ 刻意不自動套用進引擎公式；只用來讓「載入引擎草稿」更聰明 + 攤給教練看。';
