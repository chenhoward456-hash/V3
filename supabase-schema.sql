-- 健康管理系統資料庫結構

-- 1. 客戶表
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unique_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 months'),
  status TEXT DEFAULT 'normal' CHECK (status IN ('normal', 'attention', 'alert'))
);

-- 2. 血檢結果表
CREATE TABLE lab_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  reference_range TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'normal' CHECK (status IN ('normal', 'attention', 'alert')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 補品表
CREATE TABLE supplements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  timing TEXT NOT NULL,
  why TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 補品打卡記錄表
CREATE TABLE supplement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplement_id, date)
);

-- 5. 建立索引
CREATE INDEX idx_clients_unique_code ON clients(unique_code);
CREATE INDEX idx_lab_results_client_id ON lab_results(client_id);
CREATE INDEX idx_supplements_client_id ON supplements(client_id);
CREATE INDEX idx_supplement_logs_client_id ON supplement_logs(client_id);
CREATE INDEX idx_supplement_logs_date ON supplement_logs(date);

-- 6. 建立觸發器：自動更新客戶狀態
CREATE OR REPLACE FUNCTION update_client_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 根據最新的血檢結果更新客戶狀態
  UPDATE clients
  SET status = (
    SELECT CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'alert') > 0 THEN 'alert'
      WHEN COUNT(*) FILTER (WHERE status = 'attention') > 0 THEN 'attention'
      ELSE 'normal'
    END
    FROM lab_results
    WHERE client_id = NEW.client_id
  )
  WHERE id = NEW.client_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_status
  AFTER INSERT OR UPDATE ON lab_results
  FOR EACH ROW
  EXECUTE FUNCTION update_client_status();

-- 7. 啟用 Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;

-- 8. RLS 政策
-- 客戶只能透過 unique_code 訪問自己的資料
CREATE POLICY "Clients can view own data via unique_code" ON clients
  FOR SELECT USING (true);

-- 所有人都可以透過 unique_code 查看客戶資料（用於學員儀表板）
CREATE POLICY "Public can view clients via unique_code" ON clients
  FOR SELECT USING (true);

-- 只有教練可以修改客戶資料
CREATE POLICY "Only authenticated can update clients" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 只有教練可以新增客戶
CREATE POLICY "Only authenticated can insert clients" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 血檢結果政策
CREATE POLICY "Public can view lab_results via client" ON lab_results
  FOR SELECT USING (true);

CREATE POLICY "Only authenticated can modify lab_results" ON lab_results
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 補品政策
CREATE POLICY "Public can view supplements via client" ON supplements
  FOR SELECT USING (true);

CREATE POLICY "Only authenticated can modify supplements" ON supplements
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 補品打卡政策
CREATE POLICY "Public can view supplement_logs via client" ON supplement_logs
  FOR SELECT USING (true);

CREATE POLICY "Public can insert supplement_logs" ON supplement_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update supplement_logs" ON supplement_logs
  FOR UPDATE USING (true);

-- 9. 客戶表新增 training_enabled 欄位
ALTER TABLE clients ADD COLUMN IF NOT EXISTS training_enabled BOOLEAN DEFAULT FALSE;

-- 10. 訓練紀錄表
CREATE TABLE training_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('push', 'pull', 'legs', 'full_body', 'cardio', 'rest', 'chest', 'shoulder', 'arms')),
  duration INTEGER CHECK (duration > 0 OR training_type = 'rest'),
  sets INTEGER CHECK (sets > 0),
  rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- 訓練紀錄索引
CREATE INDEX idx_training_logs_client_id ON training_logs(client_id);
CREATE INDEX idx_training_logs_date ON training_logs(date);
CREATE INDEX idx_training_logs_client_date ON training_logs(client_id, date);

-- 訓練紀錄 RLS
ALTER TABLE training_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view training_logs via client" ON training_logs
  FOR SELECT USING (true);

CREATE POLICY "Public can insert training_logs" ON training_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update training_logs" ON training_logs
  FOR UPDATE USING (true);

-- 11. 建立範例資料（可選）
INSERT INTO clients (unique_code, name, age, gender, status) VALUES
  ('k8f3m2n5', '承鈞', 25, '女性', 'attention');

-- 為承鈞添加血檢數據
INSERT INTO lab_results (client_id, test_name, value, unit, reference_range, date, status) VALUES
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), 'HOMA-IR', 0.27, '', '<1.4', '2024-01-15', 'normal'),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '同半胱胺酸', 14.8, 'µmol/L', '<8.0', '2024-01-15', 'alert'),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '維生素D', 35.3, 'ng/mL', '>50', '2024-01-15', 'attention'),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '鐵蛋白', 45.9, 'ng/mL', '50-150', '2024-01-15', 'attention');

-- 為承鈞添加補品
INSERT INTO supplements (client_id, name, dosage, timing, why, sort_order) VALUES
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), 'B群(5-MTHF+B12)', '800mcg+1000mcg', '早餐', '支持同半胱胺酸代謝', 1),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), 'D3+K2', '5000IU+200mcg', '早餐', '提升維生素D水平', 2),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '鐵劑(雙甘胺酸鐵)', '25mg', '早餐', '改善鐵蛋白偏低', 3),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '肌醇(40:1)', '2g', '早餐', '改善胰島素敏感性', 4),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '鉻', '600mcg', '午餐前', '穩定血糖', 5),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '魚油', '2g', '晚餐', '抗發炎', 6),
  ((SELECT id FROM clients WHERE unique_code = 'k8f3m2n5'), '甘胺酸鎂', '400mg', '睡前', '放鬆改善睡眠', 7);
