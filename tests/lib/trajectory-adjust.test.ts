import { describe, it, expect } from 'vitest'
import { computeTrajectoryAdjustment, type TrajectoryInput } from '@/lib/trajectory-adjust'

// 產生 N 週、體重平緩的每週量測（currentRate ≈ 0），讓引擎依目標/期限算出赤字
function flatEntries(weight: number, weeks = 8): Array<{ date: string; weight: number }> {
  const out: Array<{ date: string; weight: number }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let weeksAgo = weeks - 1; weeksAgo >= 0; weeksAgo--) {
    for (const dayOffset of [0, 3, 6]) {
      const d = new Date(today)
      d.setDate(today.getDate() - weeksAgo * 7 - dayOffset)
      out.push({ date: d.toISOString().split('T')[0], weight })
    }
  }
  return out
}

function dateInDays(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// 基礎 cut 情境：82kg 平緩、目標 80kg、35 天 → 想砍約 -440 kcal/天（不撞 min_calories）
function baseInput(overrides: Partial<TrajectoryInput> = {}): TrajectoryInput {
  return {
    bodyDataEntries: flatEntries(82),
    goalType: 'cut',
    targetWeight: 80,
    targetDate: dateInDays(35),
    currentCalories: 2200,
    currentProtein: 170,
    currentFat: 60,
    currentCarbs: 200,
    currentCarbsTrainingDay: null,
    currentCarbsRestDay: null,
    gender: 'male',
    bounds: null,
    lastAdjustAt: null,
    ...overrides,
  }
}

describe('computeTrajectoryAdjustment — 基因 + 體脂安全層', () => {
  it('沒給基因/體脂時，行為與舊版相同（backward compat）', () => {
    const withoutFields = computeTrajectoryAdjustment(baseInput())
    const withInertFields = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 25, geneticProfile: { mthfr: 'normal', serotonin: 'LL' } }))
    expect(withoutFields.shouldAdjust).toBe(true)
    expect(withInertFields.newMacros?.calories_target).toBe(withoutFields.newMacros?.calories_target)
    // 正常體脂 + 無突變 → 不應出現任何基因/體脂 boundary note
    expect(withInertFields.boundaryDetail ?? '').not.toMatch(/體脂|MTHFR|5-HTTLPR/)
  })

  it('體脂低於安全下限 → 每日赤字限縮到 -500（不砍到 min_calories）', () => {
    // 更激進的目標 → raw 赤字 > 500 + > min_calories 可承受範圍
    const aggressive = { targetWeight: 78, targetDate: dateInDays(35) }
    const normalBf = computeTrajectoryAdjustment(baseInput({ ...aggressive, bodyFatPct: 25 }))
    const lowBf = computeTrajectoryAdjustment(baseInput({ ...aggressive, bodyFatPct: 8 }))

    expect(lowBf.shouldAdjust).toBe(true)
    // 低體脂被體脂下限保護：赤字較小（熱量較高）
    expect(lowBf.newMacros!.calories_target).toBeGreaterThan(normalBf.newMacros!.calories_target)
    // 赤字幅度不超過 500
    expect(Math.abs(lowBf.kcalAdjustment!)).toBeLessThanOrEqual(500)
    expect(lowBf.hitBoundary).toBe(true)
    expect(lowBf.boundaryDetail).toMatch(/體脂.*安全下限/)
  })

  it('MTHFR 雜合突變 → 赤字收窄約 100 kcal（吃更多）', () => {
    const noGene = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20 }))
    const mthfrHet = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20, geneticProfile: { mthfr: 'heterozygous' } }))

    expect(mthfrHet.shouldAdjust).toBe(true)
    const diff = mthfrHet.newMacros!.calories_target - noGene.newMacros!.calories_target
    expect(diff).toBeGreaterThanOrEqual(90) // 約 +100（rounding 容差）
    expect(diff).toBeLessThanOrEqual(110)
    expect(mthfrHet.boundaryDetail).toMatch(/MTHFR.*雜合/)
  })

  it('5-HTTLPR SL → 碳水不低於 100g，赤字被碳水下限限縮', () => {
    const noGene = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20 }))
    const serotonin = computeTrajectoryAdjustment(baseInput({ bodyFatPct: 20, geneticProfile: { serotonin: 'SL' } }))

    expect(serotonin.shouldAdjust).toBe(true)
    // 碳水下限保護 → 碳水不低於 100g
    expect(serotonin.newMacros!.carbs_target).toBeGreaterThanOrEqual(100)
    // 赤字較小（熱量較高）
    expect(serotonin.newMacros!.calories_target).toBeGreaterThan(noGene.newMacros!.calories_target)
    expect(serotonin.boundaryDetail).toMatch(/5-HTTLPR/)
  })

  it('增肌（surplus）方向不受基因/體脂安全層影響', () => {
    // bulk + 目標體重高於現況 → 正向調整，不應被赤字保護觸發
    const bulk = computeTrajectoryAdjustment(baseInput({
      goalType: 'bulk', targetWeight: 86, bodyFatPct: 8,
      geneticProfile: { mthfr: 'homozygous', serotonin: 'SS' },
    }))
    if (bulk.shouldAdjust) {
      expect(bulk.boundaryDetail ?? '').not.toMatch(/體脂|MTHFR|5-HTTLPR/)
    }
  })
})
