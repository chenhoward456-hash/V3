-- 身體數據表
CREATE TABLE body_composition (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  height DECIMAL(5,2),        -- 身高 (cm)
  weight DECIMAL(5,2),        -- 體重 (kg)
  body_fat DECIMAL(5,2),      -- 體脂肪率 (%)
  muscle_mass DECIMAL(5,2),   -- 骨骼肌 (kg)
  visceral_fat DECIMAL(5,2),  -- 內臟脂肪等級
  bmi DECIMAL(4,1),           -- BMI (計算欄位)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- 建立索引
CREATE INDEX idx_body_composition_client_id ON body_composition(client_id);
CREATE INDEX idx_body_composition_date ON body_composition(date);

-- RLS 政策
ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;

-- 簡化的 RLS 政策
CREATE POLICY "Enable all operations on body_composition" ON body_composition FOR ALL USING (true) WITH CHECK (true);

-- 範例資料
INSERT INTO body_composition (client_id, date, height, weight, body_fat, muscle_mass, visceral_fat, bmi) VALUES
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '2024-01-15', 160.0, 55.2, 22.5, 18.3, 4.0, 21.6),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '2024-02-15', 160.0, 54.8, 21.8, 18.5, 3.5, 21.4);
