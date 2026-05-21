-- Longevity W1 D1: 血檢教練解讀欄位
-- 目的：支援 NT$4,999 Protocol tier 的核心差異化 — 教練對血檢的功能醫學解讀
-- 設計：兩層解讀
--   1. lab_results.coach_interpretation：單一指標的解讀（為什麼這個 ApoB 偏高、要做什麼）
--   2. lab_panel_notes：整組血檢的綜合解讀（這次抽血整體告訴我們什麼）

-- ── 單一指標解讀 ──
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS coach_interpretation TEXT;

-- ── 整組血檢綜合解讀（per client per date）──
CREATE TABLE IF NOT EXISTS lab_panel_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  panel_date DATE NOT NULL,
  summary TEXT,                    -- 一段話：這次整組血檢的故事
  priorities TEXT,                 -- 優先處理的指標 / 介入順序
  next_review_date DATE,           -- 下次建議追蹤日期
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, panel_date)
);

CREATE INDEX IF NOT EXISTS idx_lab_panel_notes_client_date
  ON lab_panel_notes(client_id, panel_date DESC);

ALTER TABLE lab_panel_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on lab_panel_notes" ON lab_panel_notes
  FOR ALL USING (true) WITH CHECK (true);
