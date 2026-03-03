// 自動計算血檢指標狀態
// 注意：統一參考範圍定義在 utils/labStatus.ts（單一真相來源）
// 此檔案保留向後相容性，建議直接使用 utils/labStatus.ts

import { calculateLabStatus as _calculateLabStatus, LAB_THRESHOLDS } from './utils/labStatus'

export { LAB_THRESHOLDS }

function calculateLabStatus(testName: string, value: number, gender?: '男性' | '女性'): 'normal' | 'attention' | 'alert' | 'unknown' {
  return _calculateLabStatus(testName, value, gender)
}

// 在編輯介面中使用的範例
function handleLabResultChange(index: number, field: string, value: number, currentResults: any[], setResults: Function, gender?: '男性' | '女性') {
  const updatedResults = [...currentResults]
  updatedResults[index] = {
    ...updatedResults[index],
    [field]: value,
    status: calculateLabStatus(updatedResults[index].test_name, value, gender)
  }
  setResults(updatedResults)
}
