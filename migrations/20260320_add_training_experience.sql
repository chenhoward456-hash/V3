-- 訓練經驗等級（影響建議組數計算）
-- beginner: 新手（<1年），多組數熟悉動作
-- intermediate: 中階（1-3年），正常量
-- advanced: 進階（3年+），少量高強度
ALTER TABLE clients ADD COLUMN IF NOT EXISTS training_experience TEXT DEFAULT 'intermediate'
  CHECK (training_experience IN ('beginner', 'intermediate', 'advanced'));
