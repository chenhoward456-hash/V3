-- 教練端訓練計畫公版表
-- 用途：Howard 維護一組可重複套用的訓練 template（4-day split / 3-day full body / women's hypertrophy 等），
-- 套用到學員時 COPY 一份 plan_json 到 clients.training_plan，之後可獨立修改不影響母版

CREATE TABLE IF NOT EXISTS training_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  -- 篩選用 tag
  gender TEXT CHECK (gender IN ('男性', '女性', '通用') OR gender IS NULL),
  goal_type TEXT CHECK (goal_type IN ('cut', 'bulk', 'recomp', 'maintenance') OR goal_type IS NULL),
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced') OR experience_level IS NULL),
  days_per_week INT,
  knee_friendly BOOLEAN DEFAULT false,
  -- 完整計畫 JSON（跟 clients.training_plan 同一個 shape）
  plan_json JSONB NOT NULL,
  -- 教練筆記、適用學員特徵
  coach_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_templates_filter
  ON training_templates(gender, goal_type, experience_level);

COMMENT ON TABLE training_templates IS 'Howard 維護的訓練公版庫，套用時 COPY plan_json 到學員';
COMMENT ON COLUMN training_templates.plan_json IS '跟 clients.training_plan 同 shape: { name, days: [{ dayOfWeek, label, exercises: [{ name, sets, reps, rpe, note }] }], cardio?, phaseNote? }';
