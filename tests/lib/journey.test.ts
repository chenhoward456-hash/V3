import { describe, it, expect } from 'vitest'
import { buildJourney, type JourneyInput } from '@/lib/journey'

const base: JourneyInput = {
  name: 'X', goalType: 'cut', targetWeight: 80, from: '2026-08-01', to: '2026-08-28',
  weights: [], nutritionDates: [], trainingDates: [], wellnessDates: [], strength: [], profileEntries: [], experiments: [],
}
const day = (n: number) => new Date(Date.UTC(2026, 7, 1 + n)).toISOString().slice(0, 10)

describe('buildJourney', () => {
  it('體重用首週均 vs 末週均，不用單日', () => {
    const weights = Array.from({ length: 28 }, (_, i) => ({ date: day(i), weight: i < 7 ? 90 : i >= 21 ? 88 : 89, body_fat: null }))
    weights[0].weight = 95 // 單日異常值只會被週平均稀釋
    const j = buildJourney({ ...base, weights })
    expect(j.weeks).toBe(4)
    expect(j.weight!.weekly).toHaveLength(4)
    expect(j.weight!.startAvg).toBe(90.7)
    expect(j.weight!.endAvg).toBe(88)
    expect(j.weight!.toGoal).toBe(-8)
  })

  it('範圍外的記錄不算；最長連續天數跨類別', () => {
    const j = buildJourney({ ...base, nutritionDates: [day(0), day(1), '2026-07-01'], trainingDates: [day(2)], wellnessDates: [day(5)] })
    expect(j.logging.nutritionDays).toBe(2)
    expect(j.logging.longestStreak).toBe(3)
    expect(j.weight).toBeNull()
  })

  it('體脂要兩次以上；力量要同動作兩個月以上', () => {
    const j = buildJourney({
      ...base,
      weights: [{ date: day(0), weight: null, body_fat: 25 }, { date: day(20), weight: null, body_fat: 23 }],
      strength: [{ exercise: '深蹲', month: '2026-08', e1rm: 140 }, { exercise: '臥推', month: '2026-08', e1rm: 100 }],
    })
    expect(j.bodyFat!.last.value).toBe(23)
    expect(j.strength).toEqual([])
  })
})
