/**
 * Tests for @/lib/csv-parser
 *
 * Covers:
 *   - parseCSV: basic parsing, quoted fields, escaped quotes, empty lines
 *   - parseMetricsFromCSV: Chinese and English header mapping
 *   - parseSupplementsFromCSV: supplement data extraction
 *   - parseProgressFromCSV: progress data with numeric conversion
 */

import { parseCSV, parseMetricsFromCSV, parseSupplementsFromCSV, parseProgressFromCSV } from '@/lib/csv-parser'

// ════════════════════════════════════════════
// parseCSV
// ════════════════════════════════════════════

describe('parseCSV', () => {
  it('should parse simple CSV with headers', () => {
    const csv = 'name,age,city\nAlice,30,Taipei\nBob,25,Tokyo'
    const result = parseCSV(csv)
    expect(result).toEqual([
      { name: 'Alice', age: '30', city: 'Taipei' },
      { name: 'Bob', age: '25', city: 'Tokyo' },
    ])
  })

  it('should handle quoted fields containing commas', () => {
    const csv = 'name,description\nAlice,"hello, world"\nBob,"foo, bar, baz"'
    const result = parseCSV(csv)
    expect(result).toEqual([
      { name: 'Alice', description: 'hello, world' },
      { name: 'Bob', description: 'foo, bar, baz' },
    ])
  })

  it('should handle escaped double quotes inside quoted fields', () => {
    const csv = 'name,quote\nAlice,"She said ""hi"""\nBob,"Test"'
    const result = parseCSV(csv)
    expect(result[0].quote).toBe('She said "hi"')
    expect(result[1].quote).toBe('Test')
  })

  it('should return empty array for empty input', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('should skip blank lines', () => {
    const csv = 'a,b\n1,2\n\n3,4\n\n'
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ a: '1', b: '2' })
    expect(result[1]).toEqual({ a: '3', b: '4' })
  })

  it('should handle missing values (fewer columns than headers)', () => {
    const csv = 'a,b,c\n1,2\n4,5,6'
    const result = parseCSV(csv)
    expect(result[0]).toEqual({ a: '1', b: '2', c: '' })
    expect(result[1]).toEqual({ a: '4', b: '5', c: '6' })
  })

  it('should trim whitespace from values', () => {
    const csv = 'a , b \n  hello , world  '
    const result = parseCSV(csv)
    expect(result[0]).toEqual({ a: 'hello', b: 'world' })
  })

  it('should handle header-only CSV (no data rows)', () => {
    const csv = 'a,b,c'
    const result = parseCSV(csv)
    expect(result).toEqual([])
  })
})

// ════════════════════════════════════════════
// parseMetricsFromCSV
// ════════════════════════════════════════════

describe('parseMetricsFromCSV', () => {
  it('should parse Chinese-headed metrics CSV', () => {
    const csv = '指標名稱,現值,目標值,單位,描述\n體重,80,75,kg,目前體重'
    const result = parseMetricsFromCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: '體重',
      name: '體重',
      current: 80,
      target: 75,
      unit: 'kg',
      description: '目前體重',
    })
  })

  it('should parse English-headed metrics CSV', () => {
    const csv = 'name,current,target,unit,description\nWeight,80,75,kg,Current weight'
    const result = parseMetricsFromCSV(csv)
    expect(result[0].name).toBe('Weight')
    expect(result[0].current).toBe(80)
    expect(result[0].target).toBe(75)
  })

  it('should default numeric fields to 0 when missing', () => {
    const csv = 'name,current,target,unit\nWeight,,,kg'
    const result = parseMetricsFromCSV(csv)
    expect(result[0].current).toBe(0) // parseFloat('') = NaN -> || '0' => parseFloat('0') = 0
    expect(result[0].target).toBe(0)
  })

  it('should handle multiple rows', () => {
    const csv = 'name,current,target,unit\nWeight,80,75,kg\nBodyFat,20,15,%'
    const result = parseMetricsFromCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('BodyFat')
    expect(result[1].current).toBe(20)
  })

  it('should use name field as id when both id and name headers exist', () => {
    // The source prioritizes: row['指標名稱'] || row['name'] || row['id']
    // So 'name' takes precedence over 'id'
    const csv = 'id,name,current,target,unit\nw1,Weight,80,75,kg'
    const result = parseMetricsFromCSV(csv)
    expect(result[0].id).toBe('Weight')
    expect(result[0].name).toBe('Weight')
  })
})

// ════════════════════════════════════════════
// parseSupplementsFromCSV
// ════════════════════════════════════════════

describe('parseSupplementsFromCSV', () => {
  it('should parse Chinese-headed supplements CSV', () => {
    const csv = '補品名稱,劑量,服用時間,等級,目的\nD3,2000IU,早餐後,2,維生素D補充'
    const result = parseSupplementsFromCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'D3',
      name: 'D3',
      dosage: '2000IU',
      timing: '早餐後',
      level: 2,
      purpose: '維生素D補充',
    })
  })

  it('should parse English-headed supplements CSV', () => {
    const csv = 'name,dosage,timing,level,purpose\nOmega3,2g,Morning,1,EPA/DHA'
    const result = parseSupplementsFromCSV(csv)
    expect(result[0].name).toBe('Omega3')
    expect(result[0].dosage).toBe('2g')
    expect(result[0].level).toBe(1)
  })

  it('should default level to 1 when invalid or missing', () => {
    const csv = 'name,dosage,timing,level,purpose\nZinc,30mg,,,General health'
    const result = parseSupplementsFromCSV(csv)
    expect(result[0].level).toBe(1) // parseInt('') => NaN => || '1' => 1
  })

  it('should handle empty CSV', () => {
    const result = parseSupplementsFromCSV('')
    expect(result).toEqual([])
  })

  it('should handle multiple supplements', () => {
    const csv = 'name,dosage,timing,level,purpose\nD3,2000IU,AM,2,Vitamin D\nMagnesium,400mg,PM,1,Sleep'
    const result = parseSupplementsFromCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('Magnesium')
  })
})

// ════════════════════════════════════════════
// parseProgressFromCSV
// ════════════════════════════════════════════

describe('parseProgressFromCSV', () => {
  it('should parse progress data with week column', () => {
    const csv = 'week,weight,body_fat\nW1,80,20\nW2,79.5,19.5'
    const result = parseProgressFromCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ week: 'W1', weight: 80, body_fat: 20 })
    expect(result[1]).toEqual({ week: 'W2', weight: 79.5, body_fat: 19.5 })
  })

  it('should parse Chinese week column', () => {
    const csv = '週次,體重,體脂\nW1,80,20'
    const result = parseProgressFromCSV(csv)
    expect(result[0].week).toBe('W1')
  })

  it('should default non-numeric values to 0', () => {
    const csv = 'week,weight,note\nW1,80,good progress'
    const result = parseProgressFromCSV(csv)
    expect((result[0] as any).weight).toBe(80)
    expect((result[0] as any).note).toBe(0) // 'good progress' is NaN => 0
  })

  it('should handle empty CSV', () => {
    const result = parseProgressFromCSV('')
    expect(result).toEqual([])
  })

  it('should handle multiple numeric columns', () => {
    const csv = 'week,cal,protein,carbs,fat\nW1,2000,150,200,60\nW2,1950,155,190,58'
    const result = parseProgressFromCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ week: 'W1', cal: 2000, protein: 150, carbs: 200, fat: 60 })
  })
})
