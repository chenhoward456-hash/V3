-- ============================================
-- P0 Database Fixes (from Schema Audit 2026-03-10)
-- 請在 Supabase SQL Editor 中依序執行
-- ============================================

-- ━━━ P0-1: goal_type CHECK 缺少 'recomp' ━━━
-- 現有 constraint 只允許 'cut' 和 'bulk'，但 code 支援 'recomp'
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_goal_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_goal_type_check
  CHECK (goal_type IN ('cut', 'bulk', 'recomp'));

-- ━━━ P0-2: gene_depression_risk CHECK 需包含 LL/SL/SS ━━━
-- 可能舊 constraint 仍只允許 low/moderate/high，導致存不了基因型
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_gene_depression_risk_check;
ALTER TABLE clients ADD CONSTRAINT clients_gene_depression_risk_check
  CHECK (gene_depression_risk IN ('LL', 'SL', 'SS', 'low', 'moderate', 'high'));

-- 順便遷移舊值（如果有的話）
UPDATE clients SET gene_depression_risk = 'SS' WHERE gene_depression_risk = 'high';
UPDATE clients SET gene_depression_risk = 'SL' WHERE gene_depression_risk = 'moderate';
UPDATE clients SET gene_depression_risk = 'LL' WHERE gene_depression_risk = 'low';

-- ━━━ P0-4: subscription_purchases 缺少 ON DELETE CASCADE ━━━
-- 先移除舊的 FK（constraint 名稱可能不同，嘗試常見命名）
ALTER TABLE subscription_purchases
  DROP CONSTRAINT IF EXISTS subscription_purchases_client_id_fkey;
ALTER TABLE subscription_purchases
  ADD CONSTRAINT subscription_purchases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ━━━ P0-5: 修正敏感表的 RLS 政策 ━━━
-- subscription_purchases: 只有 service_role 可存取
ALTER TABLE subscription_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for subscription_purchases" ON subscription_purchases;
DROP POLICY IF EXISTS "service_role_full_access_subscription_purchases" ON subscription_purchases;
CREATE POLICY "service_role_full_access_subscription_purchases"
  ON subscription_purchases FOR ALL
  USING (auth.role() = 'service_role');

-- ai_chat_usage: 只有 service_role 可存取
ALTER TABLE ai_chat_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for ai_chat_usage" ON ai_chat_usage;
DROP POLICY IF EXISTS "service_role_full_access_ai_chat_usage" ON ai_chat_usage;
CREATE POLICY "service_role_full_access_ai_chat_usage"
  ON ai_chat_usage FOR ALL
  USING (auth.role() = 'service_role');

-- waitlist: 只有 service_role 可存取
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for waitlist" ON waitlist;
DROP POLICY IF EXISTS "service_role_full_access_waitlist" ON waitlist;
CREATE POLICY "service_role_full_access_waitlist"
  ON waitlist FOR ALL
  USING (auth.role() = 'service_role');

-- garmin_connections: 只有 service_role 可存取
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'garmin_connections') THEN
    ALTER TABLE garmin_connections ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for garmin_connections" ON garmin_connections;
    CREATE POLICY "service_role_full_access_garmin_connections"
      ON garmin_connections FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- garmin_oauth_states: 只有 service_role 可存取
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'garmin_oauth_states') THEN
    ALTER TABLE garmin_oauth_states ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for garmin_oauth_states" ON garmin_oauth_states;
    CREATE POLICY "service_role_full_access_garmin_oauth_states"
      ON garmin_oauth_states FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ━━━ 驗證 ━━━
-- 執行完後可以測試：
-- INSERT INTO clients (unique_code, name, goal_type) VALUES ('test_recomp', 'Test', 'recomp');
-- UPDATE clients SET gene_depression_risk = 'SS' WHERE unique_code = 'test_recomp';
-- 如果沒報錯就代表 constraint 修好了，記得刪掉測試資料
