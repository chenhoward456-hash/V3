/**
 * Tests for @/lib/wearable-parser
 *
 * Covers:
 *   - parseGarminCSV: Garmin Connect CSV format (English + Chinese headers)
 *   - parseAppleHealthCSV: Apple Health CSV format
 *   - parseWearableJSON: Generic JSON format
 *   - Edge cases: out-of-range clamping, missing data, large input guard
 */

import {
  parseGarminCSV,
  parseAppleHealthCSV,
  parseWearableJSON,
  type WearableRow,
} from '@/lib/wearable-parser'

// ════════════════════════════════════════════
// parseGarminCSV
// ════════════════════════════════════════════

describe('parseGarminCSV', () => {
  it('should parse standard Garmin CSV with English headers', () => {
    const csv = [
      'Date,Body Battery,Resting Heart Rate,HRV,Sleep Score,Respiration',
      '2024-03-01,75,58,55,82,16',
      '2024-03-02,80,56,60,88,15',
    ].join('\n')

    const result = parseGarminCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      date: '2024-03-01',
      device_recovery_score: 75,
      resting_hr: 58,
      hrv: 55,
      wearable_sleep_score: 82,
      respiratory_rate: 16,
    })
  })

  it('should parse Garmin CSV with Chinese headers', () => {
    const csv = [
      '日期,身體電能,靜息心率,HRV狀態,睡眠分數,呼吸速率',
      '2024-03-01,70,60,50,78,17',
    ].join('\n')

    const result = parseGarminCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].device_recovery_score).toBe(70)
    expect(result[0].resting_hr).toBe(60)
    expect(result[0].hrv).toBe(50)
  })

  it('should throw when no date column is found', () => {
    const csv = 'Body Battery,HRV\n75,55'
    expect(() => parseGarminCSV(csv)).toThrow('找不到日期欄位')
  })

  it('should throw when no recognized data columns are found', () => {
    const csv = 'Date,Unknown Column\n2024-03-01,123'
    expect(() => parseGarminCSV(csv)).toThrow('找不到可辨識的穿戴裝置數據欄位')
  })

  it('should skip rows with invalid dates', () => {
    const csv = [
      'Date,Body Battery',
      'not-a-date,75',
      '2024-03-01,80',
    ].join('\n')

    const result = parseGarminCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-03-01')
  })

  it('should handle N/A and -- values as null', () => {
    const csv = [
      'Date,Body Battery,Resting Heart Rate,HRV',
      '2024-03-01,--,N/A,55',
    ].join('\n')

    const result = parseGarminCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].device_recovery_score).toBeNull()
    expect(result[0].resting_hr).toBeNull()
    expect(result[0].hrv).toBe(55)
  })

  it('should clamp out-of-range values to null', () => {
    const csv = [
      'Date,Body Battery,Resting Heart Rate,HRV,Sleep Score,Respiration',
      '2024-03-01,150,200,500,120,50',  // all out of range
    ].join('\n')

    const result = parseGarminCSV(csv)
    // All values clamped to null => no valid data => row should be skipped
    expect(result).toHaveLength(0)
  })

  it('should skip rows where all values are null (no valid data)', () => {
    const csv = [
      'Date,Body Battery',
      '2024-03-01,',
      '2024-03-02,80',
    ].join('\n')

    const result = parseGarminCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-03-02')
  })

  it('should return empty for empty CSV', () => {
    expect(parseGarminCSV('')).toEqual([])
  })
})

// ════════════════════════════════════════════
// parseAppleHealthCSV
// ════════════════════════════════════════════

describe('parseAppleHealthCSV', () => {
  it('should parse Apple Health CSV with recognized headers', () => {
    const csv = [
      'Date,Resting Heart Rate,Heart Rate Variability,Respiratory Rate',
      '2024-03-01,58,55,16',
    ].join('\n')

    const result = parseAppleHealthCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].resting_hr).toBe(58)
    expect(result[0].hrv).toBe(55)
    expect(result[0].respiratory_rate).toBe(16)
  })

  it('should parse Apple Health CSV with Chinese headers', () => {
    const csv = [
      '日期,靜息心率,心率變異性,呼吸速率',
      '2024-03-01,60,50,15',
    ].join('\n')

    const result = parseAppleHealthCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].resting_hr).toBe(60)
    expect(result[0].hrv).toBe(50)
  })

  it('should handle various date formats', () => {
    const csv = [
      'Date,HRV',
      '2024-06-15,55',
      '2024-06-16,60',
    ].join('\n')

    const result = parseAppleHealthCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2024-06-15')
    expect(result[1].date).toBe('2024-06-16')
  })

  it('should handle Sleep Analysis column', () => {
    const csv = [
      'Date,Sleep Analysis',
      '2024-03-01,85',
    ].join('\n')

    const result = parseAppleHealthCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].wearable_sleep_score).toBe(85)
  })

  it('should throw when date column is missing', () => {
    const csv = 'HRV,Resting Heart Rate\n55,58'
    expect(() => parseAppleHealthCSV(csv)).toThrow('找不到日期欄位')
  })
})

// ════════════════════════════════════════════
// parseWearableJSON
// ════════════════════════════════════════════

describe('parseWearableJSON', () => {
  it('should parse JSON array with standard field names', () => {
    const json = JSON.stringify([
      { date: '2024-03-01', resting_hr: 58, hrv: 55, device_recovery_score: 80, wearable_sleep_score: 85, respiratory_rate: 16 },
    ])

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2024-03-01',
      resting_hr: 58,
      hrv: 55,
      device_recovery_score: 80,
      wearable_sleep_score: 85,
      respiratory_rate: 16,
    })
  })

  it('should handle nested data under "data" key', () => {
    const json = JSON.stringify({
      data: [{ date: '2024-03-01', hrv: 55 }],
    })

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0].hrv).toBe(55)
  })

  it('should handle nested data under "rows" key', () => {
    const json = JSON.stringify({
      rows: [{ date: '2024-03-01', resting_heart_rate: 60 }],
    })

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0].resting_hr).toBe(60)
  })

  it('should handle alternative field names (body_battery, recovery, etc.)', () => {
    const json = JSON.stringify([
      { date: '2024-03-01', body_battery: 75, resting_heart_rate: 58, heart_rate_variability: 50, sleep_score: 82, respiration: 16 },
    ])

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0].device_recovery_score).toBe(75)
    expect(result[0].resting_hr).toBe(58)
    expect(result[0].hrv).toBe(50)
    expect(result[0].wearable_sleep_score).toBe(82)
    expect(result[0].respiratory_rate).toBe(16)
  })

  it('should handle Chinese field names', () => {
    const json = JSON.stringify([
      { '日期': '2024-03-01', '身體電能': 70, '靜息心率': 60, '心率變異性': 50, '睡眠分數': 80, '呼吸速率': 15 },
    ])

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0].device_recovery_score).toBe(70)
  })

  it('should throw for oversized input', () => {
    const huge = 'x'.repeat(11 * 1024 * 1024) // > 10MB
    expect(() => parseWearableJSON(huge)).toThrow('檔案過大')
  })

  it('should throw for invalid JSON structure', () => {
    const json = JSON.stringify({ something: 'invalid' })
    expect(() => parseWearableJSON(json)).toThrow('JSON 格式不正確')
  })

  it('should throw when row count exceeds MAX_ROWS', () => {
    const arr = Array.from({ length: 10001 }, (_, i) => ({
      date: `2024-01-01`,
      hrv: 55,
    }))
    expect(() => parseWearableJSON(JSON.stringify(arr))).toThrow('數據行數超過上限')
  })

  it('should skip entries without valid dates', () => {
    const json = JSON.stringify([
      { date: 'invalid', hrv: 55 },
      { date: '2024-03-01', hrv: 60 },
    ])

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-03-01')
  })

  it('should clamp out-of-range values', () => {
    const json = JSON.stringify([
      { date: '2024-03-01', resting_hr: 10, hrv: 500, device_recovery_score: 150 },
    ])

    const result = parseWearableJSON(json)
    // All values out of range => clamped to null => no valid data => skipped
    expect(result).toHaveLength(0)
  })

  it('should skip entries with no valid data fields', () => {
    const json = JSON.stringify([
      { date: '2024-03-01' }, // no data fields
      { date: '2024-03-02', hrv: 55 },
    ])

    const result = parseWearableJSON(json)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-03-02')
  })
})
