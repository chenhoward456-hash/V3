-- 如果 RLS 權限有問題，執行這個來允許所有操作
DROP POLICY IF EXISTS "Public can view body_composition via client" ON body_composition;
DROP POLICY IF EXISTS "Only authenticated can modify body_composition" ON body_composition;

-- 建立更寬鬆的政策（暫時用於測試）
CREATE POLICY "Allow all operations on body_composition" ON body_composition FOR ALL USING (true) WITH CHECK (true);
