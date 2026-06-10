-- 學員 onboarding 記事本公版表
-- Howard 維護一組 LINE 記事本訊息模板（日常流程 / 飲食計畫 / 訓練哲學 / 補品 / 拍照 / 量體重 SOP 等），
-- 套用學員時做變數替換產生個人化版本，準備好就一鍵推學員 LINE

CREATE TABLE IF NOT EXISTS client_onboarding_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  goal_type TEXT CHECK (goal_type IN ('cut', 'bulk', 'recomp', 'maintenance') OR goal_type IS NULL),
  weeks_duration INT,
  source_client TEXT,
  -- sections: [{ slug, title, body_md (含 {{placeholders}}) }]
  sections JSONB NOT NULL,
  -- 預期 placeholders 說明（給人讀的）
  placeholders JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 個別學員的 rendered onboarding notes（已換成他的數字）
-- 從 client_onboarding_notes 套用後 render 完存這
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_notes_rendered JSONB DEFAULT NULL;

COMMENT ON TABLE client_onboarding_notes IS 'Howard 維護的 LINE onboarding 記事本公版庫';
COMMENT ON COLUMN client_onboarding_notes.sections IS '[{ slug, title, body_md }] — body_md 含 {{name}} / {{kcal_train}} 等 placeholder';
COMMENT ON COLUMN clients.onboarding_notes_rendered IS '套用 template 後 render 出的個人化 onboarding 訊息（準備 push LINE）';
