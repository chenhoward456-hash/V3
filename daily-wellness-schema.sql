-- 新增每日主觀感受表
CREATE TABLE daily_wellness (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- RLS 政策
ALTER TABLE daily_wellness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view all daily_wellness" ON daily_wellness
  FOR SELECT USING (auth.jwt() ->> 'role' = 'coach');

CREATE POLICY "Coaches can insert daily_wellness" ON daily_wellness
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'coach');

CREATE POLICY "Coaches can update daily_wellness" ON daily_wellness
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'coach');

CREATE POLICY "Coaches can delete daily_wellness" ON daily_wellness
  FOR DELETE USING (auth.jwt() ->> 'role' = 'coach');
