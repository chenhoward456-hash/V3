import { describe, it, expect } from 'vitest'
import { mineMeasuredTdee, mineSleepEnergy, mineRestDayEffect, isMaterialChange, mergeEntry, slopePerDay } from '@/lib/body-profile-miner'

const today = '2026-10-01'
const d = (n: number) => new Date(Date.UTC(2026, 9, 1) - n * 86400000).toISOString().slice(0, 10)

describe('slopePerDay', () => {
  it('直線', () => {
    expect(slopePerDay([{ date: d(10), value: 80 }, { date: d(0), value: 79 }])).toBeCloseTo(-0.1, 5)
  })
})

describe('mineMeasuredTdee', () => {
  it('吃 2300、每週掉 0.5kg → TDEE ≈ 2850', () => {
    const nut = Array.from({ length: 40 }, (_, i) => ({ date: d(i + 1), calories: 2300 }))
    const weights = Array.from({ length: 40 }, (_, i) => ({ date: d(i + 1), weight: 80 + (i + 1) * (0.5 / 7) }))
    const e = mineMeasuredTdee(nut, weights, today)!
    expect(e.value).toBe('≈ 2850 kcal')
    expect(e.confidence).toBe('medium')
  })
  it('資料不夠 → 不提', () => {
    const nut = Array.from({ length: 10 }, (_, i) => ({ date: d(i + 1), calories: 2300 }))
    expect(mineMeasuredTdee(nut, [], today)).toBeNull()
  })
})

describe('mineSleepEnergy', () => {
  it('睡不好精力明顯低 → 提', () => {
    const well = [
      ...Array.from({ length: 8 }, (_, i) => ({ date: d(i), sleep_quality: 5, energy_level: i % 2 ? 4 : 5 })),
      ...Array.from({ length: 6 }, (_, i) => ({ date: d(i + 20), sleep_quality: 2, energy_level: i % 2 ? 2 : 3 })),
    ]
    const e = mineSleepEnergy(well, today)!
    expect(e.key).toBe('sleep_energy')
    expect(e.value).toBe('睡不好那天精力少 2.0 分')
  })
  it('沒差 → 不提', () => {
    const well = Array.from({ length: 20 }, (_, i) => ({ date: d(i), sleep_quality: i % 2 ? 5 : 2, energy_level: i % 4 < 2 ? 3 : 4 }))
    expect(mineSleepEnergy(well, today)).toBeNull()
  })
})

describe('mineRestDayEffect', () => {
  it('訓練記錄太少 → 不提（沒記會被當休息）', () => {
    expect(mineRestDayEffect([{ date: d(1), training_type: 'push' }], [], today)).toBeNull()
  })
  it('休息隔天想練程度明顯高 → 提', () => {
    const train: { date: string; training_type: string }[] = []
    const well: { date: string; training_drive: number }[] = []
    for (let i = 1; i <= 60; i++) {
      const rest = i % 3 === 0
      if (!rest) train.push({ date: d(i), training_type: 'push' })
      well.push({ date: d(i - 1), training_drive: rest ? 5 : (i % 2 ? 3 : 2) })
    }
    const e = mineRestDayEffect(train, well, today)
    expect(e?.key).toBe('rest_day_effect')
  })
})

describe('isMaterialChange / mergeEntry', () => {
  const base = { key: 'measured_tdee', label: 'x', value: '≈ 2650 kcal', evidence: '', sample: '', confidence: 'medium' as const, measured_on: today }
  it('TDEE 差 <100 不算新', () => {
    expect(isMaterialChange(base, { key: 'measured_tdee', value: '≈ 2600 kcal' })).toBe(false)
    expect(isMaterialChange({ ...base, value: '≈ 2750 kcal' }, { key: 'measured_tdee', value: '≈ 2600 kcal' })).toBe(true)
    expect(isMaterialChange(base, undefined)).toBe(true)
  })
  it('同 key 取代、其他保留', () => {
    const out = mergeEntry({ entries: [{ ...base, value: 'old' }, { ...base, key: 'other' }] }, base, today)
    expect(out.entries.map(e => [e.key, e.value])).toEqual([['measured_tdee', '≈ 2650 kcal'], ['other', '≈ 2650 kcal']])
    expect(out.updated_at).toBe(today)
  })
})
