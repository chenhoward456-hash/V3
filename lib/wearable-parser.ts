/**
 * 穿戴裝置數據解析器
 * 支援格式：
 * - Garmin Connect CSV 匯出
 * - Apple Health CSV 匯出（透過 Health Auto Export 等第三方 app）
 * - 通用 JSON 格式
 */

import { parseCSV } from './csv-parser'

export interface WearableRow {
  date: string
  device_recovery_score: number | null
  resting_hr: number | null
  hrv: number | null
  wearable_sleep_score: number | null
  respiratory_rate: number | null
}

// Garmin Connect CSV 欄位對應（英文 + 中文）
const GARMIN_FIELD_MAP: Record<string, keyof Omit<WearableRow, 'date'>> = {
  // English
  'body battery': 'device_recovery_score',
  'resting heart rate': 'resting_hr',
  'resting hr': 'resting_hr',
  'hrv': 'hrv',
  'hrv status': 'hrv',
  'avg hrv': 'hrv',
  'sleep score': 'wearable_sleep_score',
  'respiration': 'respiratory_rate',
  'avg respiration': 'respiratory_rate',
  'respiratory rate': 'respiratory_rate',
  // 中文
  '身體電能': 'device_recovery_score',
  '靜息心率': 'resting_hr',
  'hrv狀態': 'hrv',
  '睡眠分數': 'wearable_sleep_score',
  '呼吸速率': 'respiratory_rate',
  '平均呼吸速率': 'respiratory_rate',
}

// Apple Health CSV 欄位對應（Health Auto Export / QS Access 等 app）
const APPLE_FIELD_MAP: Record<string, keyof Omit<WearableRow, 'date'>> = {
  // Common export column names
  'resting heart rate': 'resting_hr',
  'restingheartrate': 'resting_hr',
  'heart rate variability': 'hrv',
  'heartratevariability': 'hrv',
  'hrv': 'hrv',
  'sleep analysis': 'wearable_sleep_score',
  'sleepanalysis': 'wearable_sleep_score',
  'respiratory rate': 'respiratory_rate',
  'respiratoryrate': 'respiratory_rate',
  // 中文
  '靜息心率': 'resting_hr',
  '心率變異性': 'hrv',
  '睡眠分析': 'wearable_sleep_score',
  '呼吸速率': 'respiratory_rate',
}

// 日期欄位可能的名稱
const DATE_ALIASES = ['date', 'day', '日期', 'timestamp', 'start', 'start date', 'startdate', 'calendar date']

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_\-\s]+/g, ' ').trim()
}

function parseDate(value: string): string | null {
  if (!value) return null
  // 嘗試各種日期格式
  // ISO: 2024-03-01, 2024/03/01
  // US: 03/01/2024, 3/1/2024
  // Garmin: Mar 1, 2024

  // 先嘗試直接 parse
  const d = new Date(value)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }

  // 嘗試 YYYY/MM/DD
  const slashMatch = value.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`
  }

  return null
}

function clamp(val: number | null, min: number, max: number): number | null {
  if (val === null || isNaN(val)) return null
  if (val < min || val > max) return null
  return val
}

function parseNumeric(value: string | undefined): number | null {
  if (!value || value.trim() === '' || value === '--' || value === 'N/A') return null
  const num = parseFloat(value.replace(/,/g, ''))
  return isNaN(num) ? null : num
}

export function parseGarminCSV(csvText: string): WearableRow[] {
  return parseWearableCSV(csvText, GARMIN_FIELD_MAP)
}

export function parseAppleHealthCSV(csvText: string): WearableRow[] {
  return parseWearableCSV(csvText, APPLE_FIELD_MAP)
}

function parseWearableCSV(csvText: string, fieldMap: Record<string, keyof Omit<WearableRow, 'date'>>): WearableRow[] {
  const rawData = parseCSV(csvText)
  if (rawData.length === 0) return []

  // 取得原始 header 並建立對應
  const headers = Object.keys(rawData[0])
  const headerMap: Record<string, string> = {}

  // 找出日期欄位
  let dateCol: string | null = null
  for (const h of headers) {
    const normalized = normalizeHeader(h)
    if (DATE_ALIASES.includes(normalized)) {
      dateCol = h
      break
    }
  }

  // 找出數據欄位
  for (const h of headers) {
    const normalized = normalizeHeader(h)
    if (fieldMap[normalized]) {
      headerMap[h] = fieldMap[normalized]
    }
  }

  if (!dateCol) {
    throw new Error('找不到日期欄位，請確認 CSV 包含 "Date" 或 "日期" 欄位')
  }

  if (Object.keys(headerMap).length === 0) {
    throw new Error('找不到可辨識的穿戴裝置數據欄位')
  }

  const results: WearableRow[] = []

  for (const row of rawData) {
    const date = parseDate(row[dateCol])
    if (!date) continue

    const entry: WearableRow = {
      date,
      device_recovery_score: null,
      resting_hr: null,
      hrv: null,
      wearable_sleep_score: null,
      respiratory_rate: null,
    }

    for (const [origHeader, field] of Object.entries(headerMap)) {
      const val = parseNumeric(row[origHeader])
      ;(entry as any)[field] = val
    }

    // 驗證範圍
    entry.device_recovery_score = clamp(entry.device_recovery_score, 0, 100)
    entry.resting_hr = clamp(entry.resting_hr, 30, 150)
    entry.hrv = clamp(entry.hrv, 0, 300)
    entry.wearable_sleep_score = clamp(entry.wearable_sleep_score, 0, 100)
    entry.respiratory_rate = clamp(entry.respiratory_rate, 5, 40)

    // 至少有一個有效數據才加入
    const hasData = entry.device_recovery_score !== null ||
      entry.resting_hr !== null ||
      entry.hrv !== null ||
      entry.wearable_sleep_score !== null ||
      entry.respiratory_rate !== null

    if (hasData) {
      results.push(entry)
    }
  }

  return results
}

export function parseWearableJSON(jsonText: string): WearableRow[] {
  const data = JSON.parse(jsonText)
  const arr = Array.isArray(data) ? data : data.data || data.rows || data.records || []

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('JSON 格式不正確，請提供陣列格式的數據')
  }

  const results: WearableRow[] = []

  for (const item of arr) {
    // 嘗試多種可能的 key 名稱
    const rawDate = item.date || item.day || item['日期'] || item.timestamp
    const date = parseDate(String(rawDate))
    if (!date) continue

    const entry: WearableRow = {
      date,
      device_recovery_score: clamp(parseNumeric(String(item.device_recovery_score ?? item.body_battery ?? item.recovery ?? item['身體電能'] ?? '')), 0, 100),
      resting_hr: clamp(parseNumeric(String(item.resting_hr ?? item.resting_heart_rate ?? item['靜息心率'] ?? '')), 30, 150),
      hrv: clamp(parseNumeric(String(item.hrv ?? item.heart_rate_variability ?? item['心率變異性'] ?? '')), 0, 300),
      wearable_sleep_score: clamp(parseNumeric(String(item.wearable_sleep_score ?? item.sleep_score ?? item['睡眠分數'] ?? '')), 0, 100),
      respiratory_rate: clamp(parseNumeric(String(item.respiratory_rate ?? item.respiration ?? item['呼吸速率'] ?? '')), 5, 40),
    }

    const hasData = entry.device_recovery_score !== null ||
      entry.resting_hr !== null ||
      entry.hrv !== null ||
      entry.wearable_sleep_score !== null ||
      entry.respiratory_rate !== null

    if (hasData) {
      results.push(entry)
    }
  }

  return results
}
