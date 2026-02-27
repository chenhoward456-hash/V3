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

-- 12. 客戶表新增 nutrition_enabled 欄位
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nutrition_enabled BOOLEAN DEFAULT FALSE;

-- 13. 飲食紀錄表
CREATE TABLE nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  compliant BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- 飲食紀錄索引
CREATE INDEX idx_nutrition_logs_client_date ON nutrition_logs(client_id, date);

-- 飲食紀錄 RLS
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view nutrition_logs via client" ON nutrition_logs
  FOR SELECT USING (true);

CREATE POLICY "Public can insert nutrition_logs" ON nutrition_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update nutrition_logs" ON nutrition_logs
  FOR UPDATE USING (true);

-- 14. 飲食紀錄新增蛋白質與水量欄位
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS protein_grams NUMERIC;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS water_ml NUMERIC;

-- 15. 客戶表新增蛋白質與水量目標
ALTER TABLE clients ADD COLUMN IF NOT EXISTS protein_target NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS water_target NUMERIC;

-- 16. 客戶表新增功能權限欄位
ALTER TABLE clients ADD COLUMN IF NOT EXISTS body_composition_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wellness_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS supplement_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lab_enabled BOOLEAN DEFAULT FALSE;

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

-- ============================================
-- 17. 備賽監控模組 (Competition Prep)
-- ============================================

-- clients 表新增備賽相關欄位
ALTER TABLE clients ADD COLUMN IF NOT EXISTS competition_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS competition_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS prep_phase TEXT DEFAULT 'off_season';
-- prep_phase 值: 'off_season', 'bulk', 'cut', 'peak_week', 'competition', 'recovery'

-- 巨量營養素每日目標
ALTER TABLE clients ADD COLUMN IF NOT EXISTS carbs_target NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fat_target NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS calories_target NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sodium_target NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_weight NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_summary TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_goals TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_checkup_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_weekly_note TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS carbs_training_day NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS carbs_rest_day NUMERIC;

-- nutrition_logs 表新增巨量營養素欄位
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS carbs_grams NUMERIC;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS fat_grams NUMERIC;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS calories NUMERIC;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC;

-- daily_wellness 表新增備賽感受指標
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS hunger INTEGER CHECK (hunger >= 1 AND hunger <= 5);
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS digestion INTEGER CHECK (digestion >= 1 AND digestion <= 5);
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS training_drive INTEGER CHECK (training_drive >= 1 AND training_drive <= 5);

-- ============================================
-- 18. 營養素自動建議引擎 (Nutrition Engine)
-- ============================================

-- clients 表新增目標類型和飲食開始日期
ALTER TABLE clients ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT 'cut' CHECK (goal_type IN ('cut', 'bulk'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS diet_start_date DATE;

-- 活動量分型：影響 TDEE 估算與有氧/步數建議
-- sedentary（上班族）: 步數受限，以飲食控制為主，TDEE 係數較低
-- high_energy_flux（高能量通量）: 主動提高活動消耗，同樣赤字下吃更多，TDEE 係數較高
-- NULL / 未設定 = 預設中等活動量
ALTER TABLE clients ADD COLUMN IF NOT EXISTS activity_profile TEXT CHECK (activity_profile IN ('sedentary', 'high_energy_flux'));

-- 部落格文章表（由後台管理）
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('血檢優化', '營養策略', '訓練方法', '恢復優化', '個案追蹤')),
  read_time TEXT NOT NULL DEFAULT '5 分鐘',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_date ON blog_posts(date DESC);

-- 允許公開讀取文章
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read blog_posts" ON blog_posts FOR SELECT USING (true);

-- ============================================
-- 19. 健康模式 (Health Mode)
-- 目標族群：高端客戶、注重長期健康而非比賽截止日
-- 商業模式：季費（90 天一個週期）+ 配合季度血檢
-- ============================================

-- clients 表新增健康模式欄位
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_mode_enabled BOOLEAN DEFAULT FALSE;
-- quarterly_cycle_start：本季週期起始日（每 90 天更新一次）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS quarterly_cycle_start DATE;

-- daily_wellness 新增健康模式指標
-- cognitive_clarity：認知清晰度（高端客戶最在意的指標之一）
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS cognitive_clarity INTEGER CHECK (cognitive_clarity >= 1 AND cognitive_clarity <= 5);
-- stress_level：壓力指數（1=很低, 5=極高）
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5);
