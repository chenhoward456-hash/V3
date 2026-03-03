import { describe, it, expect } from 'vitest'
import { generateLabNutritionAdvice } from '../lib/lab-nutrition-advisor'

describe('generateLabNutritionAdvice', () => {
  // ── 空 input ──
  it('returns empty array for no lab results', () => {
    const advice = generateLabNutritionAdvice([])
    expect(advice).toEqual([])
  })

  // ── 全部正常 ──
  it('returns empty array when all labs are normal', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '空腹血糖', value: 85, unit: 'mg/dL', status: 'normal' },
      { test_name: '鐵蛋白', value: 80, unit: 'ng/mL', status: 'normal' },
    ])
    expect(advice).toEqual([])
  })

  // ── null value 被跳過 ──
  it('skips labs with null values', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '空腹血糖', value: null, unit: 'mg/dL', status: 'alert' },
    ])
    expect(advice).toEqual([])
  })

  // ── 空腹血糖偏高 ──
  it('generates advice for high fasting glucose', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '空腹血糖', value: 105, unit: 'mg/dL', status: 'alert' },
    ])
    expect(advice.length).toBeGreaterThan(0)
    expect(advice[0].category).toBe('glucose')
    expect(advice[0].severity).toBe('high')
    expect(advice[0].dietaryChanges.length).toBeGreaterThan(0)
  })

  it('detects fasting glucose as medium severity when between 90-100', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '空腹血糖', value: 95, unit: 'mg/dL', status: 'attention' },
    ])
    expect(advice.length).toBeGreaterThan(0)
    expect(advice[0].severity).toBe('medium')
  })

  // ── 鐵蛋白偏低 ──
  it('generates advice for low ferritin', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '鐵蛋白 Ferritin', value: 15, unit: 'ng/mL', status: 'attention' },
    ])
    expect(advice.length).toBeGreaterThan(0)
    const ironAdvice = advice.find(a => a.category === 'iron')
    expect(ironAdvice).toBeDefined()
    expect(ironAdvice!.foodsToIncrease.length).toBeGreaterThan(0)
  })

  // ── 多項異常同時處理 ──
  it('generates multiple advice items for multiple abnormal markers', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '空腹血糖', value: 110, unit: 'mg/dL', status: 'alert' },
      { test_name: '三酸甘油酯 TG', value: 200, unit: 'mg/dL', status: 'alert' },
      { test_name: '維生素D', value: 15, unit: 'ng/mL', status: 'alert' },
    ])
    expect(advice.length).toBeGreaterThanOrEqual(2)
    const categories = advice.map(a => a.category)
    expect(categories).toContain('glucose')
  })

  // ── 性別差異：鐵蛋白閾值不同 ──
  // 男性低標 50、女性低標 12
  it('uses gender-specific thresholds for ferritin', () => {
    // 值 = 15：男性低於 50 → 觸發；女性高於 12 → 不觸發
    const maleAdvice = generateLabNutritionAdvice(
      [{ test_name: '鐵蛋白 Ferritin', value: 15, unit: 'ng/mL', status: 'attention' }],
      { gender: '男性' }
    )
    const femaleAdvice = generateLabNutritionAdvice(
      [{ test_name: '鐵蛋白 Ferritin', value: 15, unit: 'ng/mL', status: 'attention' }],
      { gender: '女性' }
    )
    expect(maleAdvice.length).toBeGreaterThan(0) // 15 < 50 → triggers
    expect(femaleAdvice.length).toBe(0)           // 15 > 12 → no advice
  })

  // ── 建議結構驗證 ──
  it('returns properly structured advice objects', () => {
    const advice = generateLabNutritionAdvice([
      { test_name: '空腹血糖', value: 105, unit: 'mg/dL', status: 'alert' },
    ])
    expect(advice.length).toBeGreaterThan(0)
    const first = advice[0]
    expect(first).toHaveProperty('category')
    expect(first).toHaveProperty('title')
    expect(first).toHaveProperty('severity')
    expect(first).toHaveProperty('dietaryChanges')
    expect(first).toHaveProperty('foodsToIncrease')
    expect(first).toHaveProperty('foodsToReduce')
    expect(first).toHaveProperty('labMarker')
    expect(first).toHaveProperty('currentValue')
    expect(first).toHaveProperty('unit')
    expect(first).toHaveProperty('targetRange')
    expect(first).toHaveProperty('references')
    expect(first.references.length).toBeGreaterThan(0)
  })

  // ── matchName 模糊匹配 ──
  it('matches test names with different formats', () => {
    const advice1 = generateLabNutritionAdvice([
      { test_name: 'Fasting Glucose', value: 110, unit: 'mg/dL', status: 'alert' },
    ])
    const advice2 = generateLabNutritionAdvice([
      { test_name: '空腹血糖 (Fasting Glucose)', value: 110, unit: 'mg/dL', status: 'alert' },
    ])
    // Both should be recognized as fasting glucose
    expect(advice1.length).toBeGreaterThan(0)
    expect(advice2.length).toBeGreaterThan(0)
  })
})
