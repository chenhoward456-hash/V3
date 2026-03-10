-- ============================================================
-- Create cron_runs table for idempotency tracking
-- ============================================================
-- 用途：追蹤每次 cron job 執行紀錄，防止重複執行。
-- 使用方式：cron handler 開始時 INSERT，結束時 UPDATE status。
--           開始前先查詢是否已有同日同類型的成功紀錄。
-- ============================================================

CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL,           -- 'daily' | 'weekly' | 'monthly'
  run_date DATE NOT NULL,           -- 執行日期（用於冪等檢查）
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,                   -- 額外資訊（處理筆數等）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立唯一索引：同一天同一類型只能有一筆成功紀錄
CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_runs_unique_success
  ON cron_runs (job_type, run_date)
  WHERE status = 'completed';

-- 查詢用索引
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_date
  ON cron_runs (job_type, run_date DESC);

-- RLS: 僅 service_role 可存取
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to cron_runs"
  ON cron_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
