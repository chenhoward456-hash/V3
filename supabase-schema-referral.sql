-- ============================================
-- Referral System Schema
-- 推薦碼系統：讓用戶推薦朋友，雙方獲得獎勵
-- ============================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  reward_type TEXT DEFAULT 'free_days' CHECK (reward_type IN ('free_days', 'discount')),
  reward_value INTEGER DEFAULT 7,  -- 7 days free for referrer per successful referral
  total_referrals INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_client ON referral_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- Referral tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  reward_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referee_id)  -- Each person can only be referred once
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on referral_codes" ON referral_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on referrals" ON referrals FOR ALL USING (true) WITH CHECK (true);
