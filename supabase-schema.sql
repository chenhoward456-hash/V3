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
  status TEXT DEFAULT 'normal' CHECK (status IN ('normal', 'attention', 'alert')),
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'self_managed', 'coached'))
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
-- ⚠️ 注意：本系統所有 API 路由皆透過 Service Role Key 存取 Supabase，
-- Service Role Key 會繞過 RLS。以下政策是「最後防線」，防止意外使用 anon key 洩漏資料。
-- 主要存取控制在 API 路由的 middleware 層（auth-middleware.ts）。

-- 客戶表：只有認證用戶可存取
CREATE POLICY "Authenticated can view clients" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated can update clients" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated can insert clients" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 血檢結果政策：只有認證用戶可存取
CREATE POLICY "Authenticated can view lab_results" ON lab_results
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated can modify lab_results" ON lab_results
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 補品政策：只有認證用戶可存取
CREATE POLICY "Authenticated can view supplements" ON supplements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated can modify supplements" ON supplements
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 補品打卡政策：只有認證用戶可存取
CREATE POLICY "Authenticated can view supplement_logs" ON supplement_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert supplement_logs" ON supplement_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update supplement_logs" ON supplement_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

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

CREATE POLICY "Authenticated can view training_logs" ON training_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert training_logs" ON training_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update training_logs" ON training_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

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

CREATE POLICY "Authenticated can view nutrition_logs" ON nutrition_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert nutrition_logs" ON nutrition_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update nutrition_logs" ON nutrition_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

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
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN DEFAULT FALSE;

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
ALTER TABLE clients ADD COLUMN IF NOT EXISTS body_fat_target NUMERIC;
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
  category TEXT NOT NULL CHECK (category IN ('血檢優化', '營養科學', '訓練方法', '恢復優化', '個案追蹤')),
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

-- 健康模式 vs 備賽模式互斥約束（DB 層保護，防止直接操作繞過 UI）
ALTER TABLE clients
  ADD CONSTRAINT chk_mode_exclusive
  CHECK (NOT (health_mode_enabled = TRUE AND competition_enabled = TRUE));

-- ============================================
-- 20. 每週分析摘要 (Weekly Summaries)
-- Cron Job 每週日自動生成，紀錄歷史分析結果
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  suggested_calories INTEGER,
  suggested_protein INTEGER,
  suggested_carbs INTEGER,
  suggested_fat INTEGER,
  weekly_weight_change_rate NUMERIC(5,3),
  refeed_suggested BOOLEAN DEFAULT FALSE,
  warnings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_of)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_client ON weekly_summaries(client_id, week_of DESC);

-- ============================================
-- 21. 教練通知系統 (Coach Notifications)
-- Cron Job 自動產生 + 系統即時通知
-- ============================================

CREATE TABLE IF NOT EXISTS coach_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'weekly_digest',
  title TEXT NOT NULL,
  content TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_notifications_date ON coach_notifications(date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_notifications_read ON coach_notifications(read) WHERE read = FALSE;

-- ============================================
-- 22. 效能優化：複合索引
-- 所有以 client_id + date 查詢的表都需要複合索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_body_composition_client_date ON body_composition(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_client_date ON nutrition_logs(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_training_logs_client_date ON training_logs(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_wellness_client_date ON daily_wellness(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_client_date ON supplement_logs(client_id, date DESC);

-- ============================================
-- 23. 教練查看時間戳
-- 客戶端顯示「教練已查看 ✓」
-- ============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_last_viewed_at TIMESTAMPTZ;

-- ============================================
-- 24. 穿戴裝置生理指標（Wearable Biomarkers）
-- 支援 Apple Watch / Garmin / Whoop 等裝置的客觀恢復數據
-- 用途：取代純主觀 RPE 判斷，提供更精準的 Readiness 評估
-- ============================================

-- 靜息心率 (bpm)：基線偏移 >5bpm 持續 2+ 天 = 恢復不足
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS resting_hr NUMERIC CHECK (resting_hr >= 30 AND resting_hr <= 150);

-- HRV (ms)：低於個人基線 15%+ 持續 2+ 天 = 交感神經過度激活
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS hrv NUMERIC CHECK (hrv >= 0 AND hrv <= 300);

-- 穿戴裝置睡眠分數 (0-100)：整合深睡/淺睡/REM/清醒比例
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS wearable_sleep_score INTEGER CHECK (wearable_sleep_score >= 0 AND wearable_sleep_score <= 100);

-- 呼吸速率 (次/分)：靜息呼吸率升高 = 交感神經活躍的早期信號
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS respiratory_rate NUMERIC CHECK (respiratory_rate >= 5 AND respiratory_rate <= 40);

-- 裝置恢復分數 (0-100)：WHOOP Recovery / Oura Readiness / Garmin Body Battery
-- 使用者只需填這一個數字，引擎直接用作 Readiness Score
ALTER TABLE daily_wellness ADD COLUMN IF NOT EXISTS device_recovery_score INTEGER CHECK (device_recovery_score >= 0 AND device_recovery_score <= 100);

-- 訂閱方案層級：free（免費/驗證期）、self_managed（499自主管理）、coached（2999教練指導）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'self_managed', 'coached'));

-- ============================================
-- 25. 自主管理用戶目標期限 (Self-Managed Goal Deadline)
-- 讓 499 用戶設定「目標體重 + 預計達成日期」
-- 引擎自動倒推每週減幅、動態調整熱量
-- ============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_date DATE;

-- ============================================
-- 26. Web Push 訂閱（瀏覽器推播通知）
-- 儲存用戶的推播訂閱資訊
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client ON push_subscriptions(client_id);

-- ============================================
-- 27. 訂閱付款紀錄 (Subscription Purchases)
-- 自助註冊 + 訂閱金流
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  merchant_trade_no TEXT UNIQUE NOT NULL,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('free', 'self_managed', 'coached')),
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  ecpay_trade_no TEXT,
  client_id UUID REFERENCES clients(id),
  -- 註冊時填寫的基本資料，付款成功後用來建立 client
  registration_data JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_purchases_email ON subscription_purchases(email);
CREATE INDEX IF NOT EXISTS idx_subscription_purchases_status ON subscription_purchases(status);
CREATE INDEX IF NOT EXISTS idx_subscription_purchases_trade_no ON subscription_purchases(merchant_trade_no);

-- RLS
ALTER TABLE subscription_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on subscription_purchases" ON subscription_purchases
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 28. AI 聊天使用量追蹤 (AI Chat Usage)
-- 免費用戶每月 1 次免費體驗，由後端計數
-- ============================================

CREATE TABLE IF NOT EXISTS ai_chat_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_client_month ON ai_chat_usage(client_id, created_at);

-- RLS
ALTER TABLE ai_chat_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on ai_chat_usage" ON ai_chat_usage
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 29. LINE Messaging API 整合
-- 儲存客戶的 LINE 用戶 ID，用於查看在線狀態和推播通知
-- ============================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_line_activity TIMESTAMPTZ;

-- 30. 來源追蹤（電子書→免費版→付費轉換率）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ref_source TEXT;

-- 31. 候補名單
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  tier TEXT DEFAULT 'self_managed',
  ref_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on waitlist" ON waitlist
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_clients_line_user_id ON clients(line_user_id) WHERE line_user_id IS NOT NULL;

-- ============================================
-- 32. Garmin Connect API 直接同步
-- 儲存 OAuth 1.0a token，支援一鍵同步穿戴裝置數據
-- ============================================

CREATE TABLE IF NOT EXISTS garmin_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  access_token_secret TEXT NOT NULL,
  garmin_user_id TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS idx_garmin_connections_client ON garmin_connections(client_id);

ALTER TABLE garmin_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on garmin_connections" ON garmin_connections
  FOR ALL USING (true) WITH CHECK (true);

-- OAuth 流程中暫存 request token（授權完成後刪除）
CREATE TABLE IF NOT EXISTS garmin_oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  oauth_token TEXT NOT NULL UNIQUE,
  oauth_token_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE garmin_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on garmin_oauth_states" ON garmin_oauth_states
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 教練巨量覆寫鎖定
-- 教練手動調整營養目標後，系統自動鎖定，
-- 防止 auto-apply 覆蓋教練的決定。
-- 教練可手動解鎖，讓系統恢復自動調整。
-- ============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_macro_override JSONB DEFAULT NULL;
-- 格式：{ "locked_at": "ISO date", "locked_fields": ["calories_target","protein_target",...], "reason": "教練備註" }
-- NULL = 未鎖定（系統可自動調整）

-- ============================================
-- 簡單模式 (Simple Mode)
-- 預設簡化 UI：只顯示核心欄位，隱藏進階數據
-- 教練可在後台為每位學員開關
-- ============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS simple_mode BOOLEAN DEFAULT TRUE;

-- ============================================
-- 33. 基因風險欄位（Genetic Risk Profiles）
-- 高端差異化：根據基因檢測結果調整補品建議和 AI 顧問回覆
-- ============================================

-- MTHFR 突變：影響葉酸代謝，需要活性葉酸（methylfolate）而非一般葉酸
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_mthfr TEXT CHECK (gene_mthfr IN ('normal', 'heterozygous', 'homozygous'));

-- APOE4 基因：影響心血管風險與脂質代謝
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_apoe TEXT CHECK (gene_apoe IN ('e2/e2', 'e2/e3', 'e3/e3', 'e3/e4', 'e4/e4'));

-- 5-HTTLPR 血清素轉運體基因：LL（低風險）、SL（中風險）、SS（高風險）
-- 向後相容也接受舊值 low/moderate/high
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_depression_risk TEXT CHECK (gene_depression_risk IN ('LL', 'SL', 'SS', 'low', 'moderate', 'high'));

-- 基因檢測備註
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_notes TEXT;
