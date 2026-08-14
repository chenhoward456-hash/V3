import { describe, it, expect } from 'vitest'
import { projectMetricToDate, projectWeightVerdict, metricSlopePerWeek } from '@/lib/comp-projection'

/**
 * 這組測試守的是 2026-08-14 的真實事故：
 * Howard 距比賽 351 天、體重 81.8kg，教練端備賽倒數卡寫「體重落後 31.2kg（預測 117.2kg）」。
 * 原因是 14 天窗的斜率（賽後回水造成的 +0.1kg/天）被外推了 351 天。
 */

/** 產生一段每日體重，slope 為每天變化 */
function series(startDate: string, days: number, start: number, slopePerDay: number) {
  const out: { date: string; value: number }[] = []
  const t0 = new Date(startDate + 'T00:00:00').getTime()
  for (let i = 0; i < days; i++) {
    out.push({
      date: new Date(t0 + i * 86400000).toISOString().slice(0, 10),
      value: +(start + slopePerDay * i).toFixed(2),
    })
  }
  return out
}

describe('外推距離上限', () => {
  const rows = series('2026-08-01', 14, 80.5, 0.1) // 14 天漲 1.4kg（賽後回水的樣子）

  it('距目標日 351 天 → 不給預測（不是給 117kg）', () => {
    expect(projectMetricToDate(rows, '2027-07-31', 14)).toBeNull()
  })

  it('備賽末期（30 天內）照常給預測', () => {
    const r = projectMetricToDate(rows, '2026-09-05', 14)
    expect(r).not.toBeNull()
    expect(r!.projected).toBeGreaterThan(80)
    expect(r!.projected).toBeLessThan(90)
  })

  it('projectWeightVerdict 在距賽太遠時也回 null', () => {
    expect(projectWeightVerdict(rows, '2027-07-31', 86)).toBeNull()
  })

  it('剛好在上限內（12 週）仍給預測', () => {
    const last = rows[rows.length - 1].date
    const within = new Date(new Date(last + 'T00:00:00').getTime() + 80 * 86400000).toISOString().slice(0, 10)
    expect(projectMetricToDate(rows, within, 14)).not.toBeNull()
  })
})

describe('metricSlopePerWeek', () => {
  it('距賽再遠也算得出速率（外推才是不可信的，斜率本身可信）', () => {
    const rows = series('2026-08-01', 21, 80.5, 0.1)
    const slope = metricSlopePerWeek(rows)
    expect(slope).not.toBeNull()
    expect(slope!).toBeCloseTo(0.7, 1) // 0.1kg/天 = 0.7kg/週
  })

  it('資料太少回 null', () => {
    expect(metricSlopePerWeek([{ date: '2026-08-01', value: 80 }])).toBeNull()
  })
})
