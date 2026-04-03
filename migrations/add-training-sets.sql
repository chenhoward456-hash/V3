-- ============================================
-- Training Sets: 動作級訓練紀錄
-- 每個動作的每一組重量/次數/RPE
-- ============================================

-- 訓練動作組數紀錄
CREATE TABLE IF NOT EXISTS training_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  exercise_name TEXT NOT NULL,           -- 動作名稱（深蹲、臥推、硬舉...）
  muscle_group TEXT,                     -- 肌群（chest, back, shoulders, legs, arms, core）
  set_number INTEGER NOT NULL DEFAULT 1, -- 第幾組
  weight NUMERIC,                        -- 重量 kg
  reps INTEGER,                          -- 次數
  rpe NUMERIC,                           -- 該組 RPE（可選）
  is_main_lift BOOLEAN DEFAULT false,    -- 主項標記（用於 E1RM 追蹤）
  note TEXT,                             -- 備註
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_training_sets_client_date ON training_sets(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_training_sets_exercise ON training_sets(client_id, exercise_name, date DESC);

-- RLS
ALTER TABLE training_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view training_sets" ON training_sets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert training_sets" ON training_sets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update training_sets" ON training_sets
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete training_sets" ON training_sets
  FOR DELETE USING (auth.role() = 'authenticated');

-- Service role bypass
CREATE POLICY "Service role full access training_sets" ON training_sets
  FOR ALL USING (auth.role() = 'service_role');
