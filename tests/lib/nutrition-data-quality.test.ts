import { describe, it, expect } from 'vitest'
import { assessNutritionQuality, qualityNote } from '@/lib/nutrition-data-quality'

describe('飲食紀錄品質判斷', () => {
  it('Howard 的真實資料：9 筆裡 7 筆都是 3145 → 判定為一鍵填入', () => {
    const log = [3145, 3145, 3145, 2865, 3145, 3210, 3145, 3145, 3145]
    const q = assessNutritionQuality(log, 3000)
    expect(q.looksAutoFilled).toBe(true)
    expect(q.modalValue).toBe(3145)
    expect(q.modalRatio).toBeGreaterThan(0.6)
    expect(qualityNote(q)).toContain('3145')
  })

  it('真的量出來的資料：每天都不一樣 → 可信', () => {
    const log = [2840, 3210, 2650, 3480, 2990, 3120, 2760, 3350]
    const q = assessNutritionQuality(log, 3000)
    expect(q.looksAutoFilled).toBe(false)
    expect(qualityNote(q)).toBeNull()
  })

  it('眾數剛好等於目標熱量 → 即使佔比只有 40% 也判定為按鈕', () => {
    // 5/10 剛好是目標 2000，其餘散開
    const log = [2000, 2000, 2000, 2000, 2000, 1850, 2240, 1930, 2110, 2380]
    const q = assessNutritionQuality(log, 2000)
    expect(q.looksAutoFilled).toBe(true)
  })

  it('同樣的分布但眾數不等於目標 → 不判定（可能真的常吃同一份餐）', () => {
    const log = [2000, 2000, 2000, 2000, 1850, 2240, 1930, 2110, 2380, 2050]
    const q = assessNutritionQuality(log, 3000)
    expect(q.modalRatio).toBeLessThan(0.6)
    expect(q.looksAutoFilled).toBe(false)
  })

  it('樣本太少 → 不下判斷（寧可放行）', () => {
    expect(assessNutritionQuality([3000, 3000, 3000], 3000).looksAutoFilled).toBe(false)
    expect(assessNutritionQuality([], 3000).looksAutoFilled).toBe(false)
  })

  it('null / 0 / 非數字會被濾掉，不影響判斷', () => {
    const q = assessNutritionQuality([3145, null, 3145, 0, 3145, undefined, 3145, 2900, 3145], 3000)
    expect(q.samples).toBe(6)   // 3145×4 + 2900 + ... null/0/undefined 被濾掉
    expect(q.looksAutoFilled).toBe(true)
  })

  it('提示語不指控學員（一鍵達標是系統給的功能，用它不是作弊）', () => {
    const note = qualityNote(assessNutritionQuality([3145, 3145, 3145, 3145, 3145, 2865], 3000))!
    expect(note).not.toContain('作弊')
    expect(note).not.toContain('說謊')
    expect(note).toContain('體重趨勢')
  })
})
