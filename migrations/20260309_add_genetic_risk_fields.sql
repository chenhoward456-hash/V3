-- ============================================
-- 33. 基因風險欄位（Genetic Risk Profiles）
-- 高端差異化：根據基因檢測結果調整補品建議和 AI 顧問回覆
-- ============================================

-- MTHFR 突變：影響葉酸代謝，需要活性葉酸（methylfolate）而非一般葉酸
-- 值：null（未檢測）、'normal'（正常）、'heterozygous'（雜合突變 C677T/A1298C）、'homozygous'（純合突變 C677T）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_mthfr TEXT CHECK (gene_mthfr IN ('normal', 'heterozygous', 'homozygous'));

-- APOE4 基因：影響心血管風險與脂質代謝
-- 值：null（未檢測）、'e2/e3'、'e3/e3'（最常見）、'e3/e4'（一個 e4）、'e4/e4'（兩個 e4，高風險）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_apoe TEXT CHECK (gene_apoe IN ('e2/e2', 'e2/e3', 'e3/e3', 'e3/e4', 'e4/e4'));

-- 憂鬱傾向基因：COMT、5-HTTLPR 等影響神經傳導物質代謝的基因變異
-- 簡化為風險等級：null（未檢測）、'low'、'moderate'、'high'
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_depression_risk TEXT CHECK (gene_depression_risk IN ('low', 'moderate', 'high'));

-- 基因檢測備註：教練可記錄其他基因相關資訊
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gene_notes TEXT;
