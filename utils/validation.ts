// 輸入驗證工具函數

/**
 * 驗證血檢數值
 * @param testName 檢測項目名稱
 * @param value 檢測數值
 * @returns 驗證結果
 */
export function validateLabValue(testName: string, value: number): { isValid: boolean; error: string } {
  // 檢查是否為數字
  if (typeof value !== 'number' || isNaN(value)) {
    return { isValid: false, error: '檢測數值必須是有效的數字' }
  }
  
  // 檢查是否為正數
  if (value < 0) {
    return { isValid: false, error: '檢測數值必須為正數' }
  }
  
  // 特定項目的範圍檢查
  const ranges: Record<string, { min: number; max: number }> = {
    'HOMA-IR': { min: 0, max: 10 },
    '同半胱胺酸': { min: 0, max: 100 },
    '空腹胰島素': { min: 0, max: 100 },
    '空腹血糖': { min: 0, max: 500 },
    '維生素D': { min: 0, max: 200 },
    '鐵蛋白': { min: 0, max: 1000 },
    '三酸甘油酯': { min: 0, max: 1000 },
    'Lp(a)': { min: 0, max: 200 },
    'ApoB': { min: 0, max: 300 },
    '鎂': { min: 0, max: 10 },
    '鋅': { min: 0, max: 5000 }
  }
  
  const range = ranges[testName]
  if (range && (value < range.min || value > range.max)) {
    return { 
      isValid: false, 
      error: `${testName} 的有效範圍是 ${range.min} - ${range.max}` 
    }
  }
  
  return { isValid: true, error: '' }
}

/**
 * 驗證補品名稱
 * @param name 補品名稱
 * @returns 驗證結果
 */
export function validateSupplementName(name: string): { isValid: boolean; error: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: '補品名稱不能為空' }
  }
  
  // 長度檢查
  if (name.length < 1 || name.length > 100) {
    return { isValid: false, error: '補品名稱長度必須在 1-100 字元之間' }
  }
  
  // XSS 防護 - 檢查危險字符
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      return { isValid: false, error: '補品名稱包含不安全的字符' }
    }
  }
  
  return { isValid: true, error: '' }
}

/**
 * 驗證補品劑量
 * @param dosage 劑量
 * @returns 驗證結果
 */
export function validateSupplementDosage(dosage: string): { isValid: boolean; error: string } {
  if (!dosage || typeof dosage !== 'string') {
    return { isValid: false, error: '補品劑量不能為空' }
  }
  
  if (dosage.length < 1 || dosage.length > 50) {
    return { isValid: false, error: '補品劑量長度必須在 1-50 字元之間' }
  }
  
  return { isValid: true, error: '' }
}

/**
 * 驗證身體數據
 * @param field 欄位名稱
 * @param value 數值
 * @returns 驗證結果
 */
export function validateBodyComposition(field: string, value: number): { isValid: boolean; error: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { isValid: false, error: `${field} 必須是有效的數字` }
  }
  
  if (value < 0) {
    return { isValid: false, error: `${field} 必須為正數` }
  }
  
  // 特定欄位的範圍檢查
  const ranges: Record<string, { min: number; max: number }> = {
    height: { min: 100, max: 250 }, // 身高 100-250cm
    weight: { min: 20, max: 300 }, // 體重 20-300kg
    body_fat: { min: 0, max: 100 }, // 體脂率 0-100%
    muscle_mass: { min: 0, max: 200 }, // 肌肉量 0-200kg
    visceral_fat: { min: 1, max: 30 }, // 內臟脂肪等級 1-30
    bmi: { min: 10, max: 50 } // BMI 10-50
  }
  
  const range = ranges[field]
  if (range && (value < range.min || value > range.max)) {
    return { 
      isValid: false, 
      error: `${field} 的有效範圍是 ${range.min} - ${range.max}` 
    }
  }
  
  return { isValid: true, error: '' }
}

/**
 * 驗證日期
 * @param date 日期字串
 * @returns 驗證結果
 */
export function validateDate(date: string): { isValid: boolean; error: string } {
  if (!date || typeof date !== 'string') {
    return { isValid: false, error: '日期不能為空' }
  }
  
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: '無效的日期格式' }
  }
  
  // 檢查日期是否在合理範圍內（1900-2100年）
  const year = dateObj.getFullYear()
  if (year < 1900 || year > 2100) {
    return { isValid: false, error: '日期必須在 1900-2100 年之間' }
  }
  
  // 檢查日期不能是未來
  if (dateObj > new Date()) {
    return { isValid: false, error: '日期不能是未來時間' }
  }
  
  return { isValid: true, error: '' }
}

/**
 * 清理輸入字串（移除多餘空白、轉義特殊字符）
 * @param input 輸入字串
 * @returns 清理後的字串
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除 < > 字符
    .replace(/javascript:/gi, '') // 移除 javascript: 協議
    .replace(/on\w+=/gi, '') // 移除事件處理器
}
