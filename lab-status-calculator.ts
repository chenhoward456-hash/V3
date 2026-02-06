// 自動計算血檢指標狀態
function calculateLabStatus(testName: string, value: number): 'normal' | 'attention' | 'alert' {
  const thresholds: Record<string, any> = {
    'HOMA-IR': { normal: 1.4, attention: 2.0 },
    '同半胱胺酸': { normal: 8.0, attention: 12.0 },
    '空腹胰島素': { normal: 5.0, attention: 8.0 },
    '空腹血糖': { normal: 90, attention: 100 },
    '維生素D': { normal: 50, attention: 30 }, // 注意：維生素D是越高越好
    '鐵蛋白': { normal: { min: 50, max: 150 }, attention: { min: 30, max: 200 } },
    '三酸甘油酯': { normal: 100, attention: 150 },
    'Lp(a)': { normal: 30, attention: 50 },
    'ApoB': { normal: 80, attention: 100 },
    '鎂': { normal: { min: 2.0, max: 2.4 }, attention: { min: 1.8, max: 2.6 } },
    '鋅': { normal: { min: 700, max: 1200 }, attention: { min: 600, max: 1400 } }
  };
  
  const threshold = thresholds[testName];
  if (!threshold) return 'normal';
  
  // 處理範圍型閾值（如鐵蛋白）
  if (typeof threshold.normal === 'object' && 'min' in threshold.normal) {
    if (value >= threshold.normal.min && value <= threshold.normal.max) {
      return 'normal';
    }
    if (value >= threshold.attention.min && value <= threshold.attention.max) {
      return 'attention';
    }
    return 'alert';
  }
  
  // 處理維生素D（越高越好）
  if (testName === '維生素D') {
    if (value >= threshold.normal) return 'normal';
    if (value >= threshold.attention) return 'attention';
    return 'alert';
  }
  
  // 處理一般數值（越低越好）
  if (value <= threshold.normal) return 'normal';
  if (value <= threshold.attention) return 'attention';
  return 'alert';
}

// 在編輯介面中使用的範例
function handleLabResultChange(index: number, field: string, value: number, currentResults: any[], setResults: Function) {
  const updatedResults = [...currentResults]
  updatedResults[index] = {
    ...updatedResults[index],
    [field]: value,
    status: calculateLabStatus(updatedResults[index].test_name, value)
  }
  setResults(updatedResults)
}
