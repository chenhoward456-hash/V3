-- 備賽版缺口（2026-11-01，Temu 實戰對照）：進度照片＋賽前清單/試灌結果

-- 進度照片：每週同光線同姿勢 4 張（比賽看的是照片，不是 InBody）
CREATE TABLE IF NOT EXISTS progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  taken_on DATE NOT NULL,
  pose TEXT NOT NULL CHECK (pose IN ('front', 'back_lat', 'side', 'back')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, taken_on, pose)
);
CREATE INDEX IF NOT EXISTS idx_progress_photos_client_date ON progress_photos(client_id, taken_on DESC);
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;  -- 無 policy，走 service_role

-- 賽前清單勾選＋試灌結果（item_key='trial_result' 的 value = {visual}）
CREATE TABLE IF NOT EXISTS peak_week_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competition_date DATE NOT NULL,
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 40),
  value JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, competition_date, item_key)
);
ALTER TABLE peak_week_checks ENABLE ROW LEVEL SECURITY;  -- 無 policy，走 service_role

-- 私有 bucket（只能 service_role 讀寫，前端拿 signed URL）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('progress-photos', 'progress-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
