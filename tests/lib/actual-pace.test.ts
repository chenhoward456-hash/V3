import { describe, it, expect } from 'vitest'
import { describeActualPace } from '@/lib/nutrition-engine'

const ww = (...avgs: number[]) => avgs.map((avgWeight, week) => ({ week, avgWeight }))

describe('describeActualPace：達不達標照實際多週體重講，不替計畫蓋章', () => {
  it('不到 3 週資料 → 不下結論', () => {
    expect(describeActualPace(ww(85, 85.5), 5, 60)).toContain('再看 1–2 週')
  })
  it('單週補成兩筆的重複週不算', () => {
    expect(describeActualPace([{ week: 0, avgWeight: 85 }, { week: 0, avgWeight: 85 }, { week: 1, avgWeight: 85 }], 5, 60)).toContain('再看 1–2 週')
  })
  it('實際跟得上 → 跟得上', () => {
    // 每週掉 0.5，剩 3kg、還 49 天 → 6 週到
    expect(describeActualPace(ww(85, 85.5, 86, 86.5), 3, 49)).toContain('跟得上')
  })
  it('Sean 型：計畫寫每週 0.72 但實際只掉 0.3 → 比目標日晚', () => {
    const t = describeActualPace(ww(85.3, 85.6, 85.9, 86.2), 8.3, 49)
    expect(t).toContain('比目標日晚')
    expect(t).not.toContain('達標')
  })
  it('體重沒往下走 → 直說到不了', () => {
    expect(describeActualPace(ww(82.8, 82.6, 82.7, 82.6), 5.8, 15)).toContain('沒在往下走')
  })
})
