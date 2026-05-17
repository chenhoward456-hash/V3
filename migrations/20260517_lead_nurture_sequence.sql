-- Lead Nurture Sequence — 12 天 LINE 養客序列
-- 用途：追蹤每個 LINE follower（非付費學員）的訊息排程進度
-- Day 0 = follow 當下立刻發；Day 2/4/6/8/10/12 = 之後 cron 排程發

CREATE TABLE IF NOT EXISTS nurture_subscribers (
  line_user_id TEXT PRIMARY KEY,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active', -- active | completed | unfollowed | converted
  last_sent_day INTEGER NOT NULL DEFAULT 0, -- 0 = 已發歡迎訊息；2/4/6/8/10/12 = 已發對應 Day
  display_name TEXT,
  picture_url TEXT,
  -- 互動追蹤（之後可加）
  diagnosis_clicked_at TIMESTAMPTZ,
  pdf_downloaded_at TIMESTAMPTZ,
  -- 房子記錄
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurture_subscribers_status
  ON nurture_subscribers(status);

CREATE INDEX IF NOT EXISTS idx_nurture_subscribers_dispatch
  ON nurture_subscribers(status, last_sent_day, followed_at)
  WHERE status = 'active';

-- 自動更新 updated_at trigger
CREATE OR REPLACE FUNCTION update_nurture_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nurture_subscribers_updated_at ON nurture_subscribers;
CREATE TRIGGER trg_nurture_subscribers_updated_at
  BEFORE UPDATE ON nurture_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_nurture_subscribers_updated_at();

-- RLS：只允許 service role 操作（webhook + cron 都用 service client）
ALTER TABLE nurture_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_nurture" ON nurture_subscribers;
CREATE POLICY "service_role_all_nurture" ON nurture_subscribers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE nurture_subscribers IS '12 天 LINE 養客序列訂閱者（非付費學員）';
COMMENT ON COLUMN nurture_subscribers.last_sent_day IS '最後發送的訊息天數 (0 = 歡迎訊息已發；2/4/6/8/10/12 = 對應 Day)';
COMMENT ON COLUMN nurture_subscribers.status IS 'active=序列中, completed=12 天跑完, unfollowed=用戶取消追蹤, converted=綁定為付費學員';
