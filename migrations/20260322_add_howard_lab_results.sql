-- Howard (陳胤豪) 2026-03-20 血檢數據
-- 聯合醫事檢驗所 檢體編號 6032002902 + 6032002901
-- test_name 使用 preset 名稱，確保跟之前的數據能做趨勢比對
-- Bioavailable Testosterone 無 preset，用英文名（跟之前手動輸入一致）

INSERT INTO lab_results (client_id, test_name, value, unit, reference_range, date, status)
SELECT id, test_name, value, unit, reference_range, '2026-03-20', status
FROM clients,
(VALUES
  ('睪固酮', 403.92, 'ng/dL', '164.94-753.38', 'normal'),
  ('游離睪固酮', 72.8, 'pg/mL', '47-244', 'normal'),
  ('SHBG', 38.4, 'nmol/L', '18.3-54.1', 'normal'),
  ('Bioavailable Testosterone', 182.0, 'ng/dL', '125.6-411.8', 'normal'),
  ('白蛋白', 4.6, 'g/dL', '3.5-5.0', 'normal'),
  ('雌二醇', 42.4, 'pg/mL', '10-40', 'attention')
) AS v(test_name, value, unit, reference_range, status)
WHERE clients.name = '陳胤豪';
