-- 主項重量追蹤（漸進式超負荷監控）
-- compound_weight: 當天主項使用重量（kg）
-- compound_reps: 當天主項完成次數
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS compound_weight NUMERIC DEFAULT NULL;
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS compound_reps INTEGER DEFAULT NULL;
