-- ============================================================
-- Fix RLS Policies: Replace USING (true) with service_role check
-- ============================================================
-- 問題：部分表的 RLS policy 使用 USING (true)，等同於沒有保護。
-- 修正：改為 USING (auth.role() = 'service_role')，僅允許 service_role 存取。
-- 注意：本服務透過 API route + service_role key 存取資料庫，不使用 anon key。
--       因此所有 client-facing 存取都經過 API route 的權限檢查。
-- ============================================================

-- clients
DROP POLICY IF EXISTS "Allow all access to clients" ON clients;
CREATE POLICY "Service role full access to clients"
  ON clients
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- nutrition_logs
DROP POLICY IF EXISTS "Allow all access to nutrition_logs" ON nutrition_logs;
CREATE POLICY "Service role full access to nutrition_logs"
  ON nutrition_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- daily_wellness
DROP POLICY IF EXISTS "Allow all access to daily_wellness" ON daily_wellness;
CREATE POLICY "Service role full access to daily_wellness"
  ON daily_wellness
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- training_logs
DROP POLICY IF EXISTS "Allow all access to training_logs" ON training_logs;
CREATE POLICY "Service role full access to training_logs"
  ON training_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- body_composition
DROP POLICY IF EXISTS "Allow all access to body_composition" ON body_composition;
CREATE POLICY "Service role full access to body_composition"
  ON body_composition
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
