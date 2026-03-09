-- 更新 5-HTTLPR 血清素轉運體基因欄位
-- 從風險等級 (low/moderate/high) 改為基因型 (LL/SL/SS)
-- 保留向後相容：接受新舊格式

-- 1. 移除舊的 CHECK 約束
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_gene_depression_risk_check;

-- 2. 加入新的 CHECK 約束（同時接受新舊值，方便漸進遷移）
ALTER TABLE clients ADD CONSTRAINT clients_gene_depression_risk_check
  CHECK (gene_depression_risk IN ('LL', 'SL', 'SS', 'low', 'moderate', 'high'));

-- 3. 將舊值遷移為新基因型
UPDATE clients SET gene_depression_risk = 'SS' WHERE gene_depression_risk = 'high';
UPDATE clients SET gene_depression_risk = 'SL' WHERE gene_depression_risk = 'moderate';
UPDATE clients SET gene_depression_risk = 'LL' WHERE gene_depression_risk = 'low';

-- 4. 更新 CHECK 約束為僅接受基因型（遷移完成後執行）
-- ALTER TABLE clients DROP CONSTRAINT clients_gene_depression_risk_check;
-- ALTER TABLE clients ADD CONSTRAINT clients_gene_depression_risk_check
--   CHECK (gene_depression_risk IN ('LL', 'SL', 'SS'));
