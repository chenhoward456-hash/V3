-- 血檢公版表
-- Howard 維護的 4 個（男/女 × 目標/一般健康）lab panel template，
-- 套用學員 → 推到 Howard LINE → copy 給學員去抽血

CREATE TABLE IF NOT EXISTS lab_panel_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  gender TEXT CHECK (gender IN ('男性', '女性', '通用') OR gender IS NULL),
  -- 'target' = 健體/減脂目標導向 / 'general_health' = 長壽/一般優化
  goal_orientation TEXT CHECK (goal_orientation IN ('target', 'general_health')),
  -- 底盤套餐 A / B / C / E / null
  base_package TEXT,
  base_price INT,
  -- [{ code, name, price, why, priority: 'must'/'optional', source: 'lab'/'outsource' }]
  add_on_items JSONB NOT NULL,
  estimated_total INT,
  -- 抽血時機 / 空腹 / MC 期 / 注意事項
  prep_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 個別學員的 rendered lab recommendation
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lab_panel_recommended JSONB DEFAULT NULL;

COMMENT ON TABLE lab_panel_templates IS 'Howard 維護的血檢公版（男/女 × 目標/一般健康 4 個）';
COMMENT ON COLUMN clients.lab_panel_recommended IS '個別學員的 rendered 血檢建議（套用 lab_panel_templates 後 snapshot）';
