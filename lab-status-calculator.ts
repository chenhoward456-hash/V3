// 自動計算血檢指標狀態
// 注意：統一參考範圍定義在 utils/labStatus.ts（單一真相來源）
// 此檔案保留向後相容性，建議直接使用 utils/labStatus.ts

import { calculateLabStatus as _calculateLabStatus, LAB_THRESHOLDS } from './utils/labStatus'

export { LAB_THRESHOLDS }

function calculateLabStatus(testName: string, value: number, gender?: '男性' | '女性'): 'normal' | 'attention' | 'alert' {
  return _calculateLabStatus(testName, value, gender)
}

// 在編輯介面中使用的範例
function handleLabResultChange(index: number, field: string, value: number, currentResults: any[], setResults: Function, gender?: '男性' | '女性') {
  const updatedResults = [...currentResults]
  const updated = { ...updatedResults[index], [field]: value }
  // 使用更新後的 test_name 和 value 重新計算 status
  const testName = field === 'test_name' ? value as unknown as string : updated.test_name
  const numValue = field === 'value' ? value : updated.value
  if (typeof numValue === 'number' && typeof testName === 'string') {
    updated.status = calculateLabStatus(testName, numValue, gender)
  }
  updatedResults[index] = updated
  setResults(updatedResults)
}
