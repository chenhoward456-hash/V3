-- 安全性加強的 RLS 政策

-- 刪除現有的不安全政策
DROP POLICY IF EXISTS "Clients can view own data via unique_code" ON clients;
DROP POLICY IF EXISTS "Public can view clients via unique_code" ON clients;
DROP POLICY IF EXISTS "Only authenticated can update clients" ON clients;
DROP POLICY IF EXISTS "Only authenticated can insert clients" ON clients;
DROP POLICY IF EXISTS "Public can view lab_results via client" ON lab_results;
DROP POLICY IF EXISTS "Only authenticated can modify lab_results" ON lab_results;
DROP POLICY IF EXISTS "Public can view supplements via client" ON supplements;
DROP POLICY IF EXISTS "Only authenticated can modify supplements" ON supplements;
DROP POLICY IF EXISTS "Public can view supplement_logs via client" ON supplement_logs;
DROP POLICY IF EXISTS "Public can insert supplement_logs" ON supplement_logs;
DROP POLICY IF EXISTS "Public can update supplement_logs" ON supplement_logs;

-- 建立新的安全政策

-- 1. 客戶表政策
-- 教練可以讀取所有客戶資料
CREATE POLICY "Coaches can view all clients" ON clients
  FOR SELECT USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以新增客戶
CREATE POLICY "Coaches can insert clients" ON clients
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'coach');

-- 教練可以更新客戶資料
CREATE POLICY "Coaches can update clients" ON clients
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以刪除客戶
CREATE POLICY "Coaches can delete clients" ON clients
  FOR DELETE USING (auth.jwt() ->> 'role' = 'coach');

-- 2. 血檢結果表政策
-- 教練可以讀取所有血檢結果
CREATE POLICY "Coaches can view all lab_results" ON lab_results
  FOR SELECT USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以新增血檢結果
CREATE POLICY "Coaches can insert lab_results" ON lab_results
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'coach');

-- 教練可以更新血檢結果
CREATE POLICY "Coaches can update lab_results" ON lab_results
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以刪除血檢結果
CREATE POLICY "Coaches can delete lab_results" ON lab_results
  FOR DELETE USING (auth.jwt() ->> 'role' = 'coach');

-- 3. 補品表政策
-- 教練可以讀取所有補品資料
CREATE POLICY "Coaches can view all supplements" ON supplements
  FOR SELECT USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以新增補品
CREATE POLICY "Coaches can insert supplements" ON supplements
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'coach');

-- 教練可以更新補品
CREATE POLICY "Coaches can update supplements" ON supplements
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以刪除補品
CREATE POLICY "Coaches can delete supplements" ON supplements
  FOR DELETE USING (auth.jwt() ->> 'role' = 'coach');

-- 4. 補品打卡記錄表政策
-- 教練可以讀取所有打卡記錄
CREATE POLICY "Coaches can view all supplement_logs" ON supplement_logs
  FOR SELECT USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以新增打卡記錄
CREATE POLICY "Coaches can insert supplement_logs" ON supplement_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'coach');

-- 教練可以更新打卡記錄
CREATE POLICY "Coaches can update supplement_logs" ON supplement_logs
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以刪除打卡記錄
CREATE POLICY "Coaches can delete supplement_logs" ON supplement_logs
  FOR DELETE USING (auth.jwt() ->> 'role' = 'coach');

-- 5. 身體數據表政策（如果存在）
-- 教練可以讀取所有身體數據
CREATE POLICY "Coaches can view all body_composition" ON body_composition
  FOR SELECT USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以新增身體數據
CREATE POLICY "Coaches can insert body_composition" ON body_composition
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'coach');

-- 教練可以更新身體數據
CREATE POLICY "Coaches can update body_composition" ON body_composition
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'coach');

-- 教練可以刪除身體數據
CREATE POLICY "Coaches can delete body_composition" ON body_composition
  FOR DELETE USING (auth.jwt() ->> 'role' = 'coach');

-- 6. 為未來的學員角色預留政策（暫時不啟用）
-- 學員只能讀取自己的資料
-- CREATE POLICY "Clients can view own data" ON clients
--   FOR SELECT USING (auth.uid() = id);

-- CREATE POLICY "Clients can view own lab_results" ON lab_results
--   FOR SELECT USING (auth.uid() = client_id);

-- CREATE POLICY "Clients can view own supplements" ON supplements
--   FOR SELECT USING (auth.uid() = client_id);

-- CREATE POLICY "Clients can view own supplement_logs" ON supplement_logs
--   FOR SELECT USING (auth.uid() = client_id);

-- CREATE POLICY "Clients can view own body_composition" ON body_composition
--   FOR SELECT USING (auth.uid() = client_id);
