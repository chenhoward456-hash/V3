import { describe, it, expect } from 'vitest'
import {
  computeSleepRegularity,
  parseTime,
  timeRangeMinutes,
  sleepHours,
  type DayEntry,
} from '@/lib/sleep-regularity'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

const day = (bed: string, wake: string): DayEntry => ({ bed, wake })

describe('parseTime', () => {
  it('接受合法 HH:MM', () => {
    expect(parseTime('23:30')).toBe(23 * 60 + 30)
    expect(parseTime('7:05')).toBe(7 * 60 + 5)
    expect(parseTime('00:00')).toBe(0)
  })
  it('拒絕不合法輸入', () => {
    for (const bad of ['', '24:00', '12:60', 'abc', '7', '7:5']) expect(parseTime(bad)).toBeNull()
  })
})

describe('timeRangeMinutes 跨午夜', () => {
  it('23:30 與 00:30 相差 1 小時，不是 23 小時', () => {
    expect(timeRangeMinutes([23 * 60 + 30, 30])).toBe(60)
  })
  it('一般同日時刻正常', () => {
    expect(timeRangeMinutes([6 * 60, 8 * 60])).toBe(120)
  })
  it('少於兩筆回 null', () => {
    expect(timeRangeMinutes([420])).toBeNull()
  })
})

describe('sleepHours', () => {
  it('跨午夜：23:00 上床、07:00 起床 = 8 小時', () => {
    expect(sleepHours(23 * 60, 7 * 60)).toBe(8)
  })
  it('同日：01:00 上床、09:00 起床 = 8 小時', () => {
    expect(sleepHours(60, 9 * 60)).toBe(8)
  })
})

describe('computeSleepRegularity', () => {
  it('少於 3 天 → insufficient，不給漂移數字', () => {
    const r = computeSleepRegularity([day('23:00', '07:00'), day('23:00', '07:00')])
    expect(r.level).toBe('insufficient')
    expect(r.driftHours).toBeNull()
    expect(r.daysFilled).toBe(2)
  })

  it('每天完全一樣 → steady，漂移 0', () => {
    const r = computeSleepRegularity(Array(7).fill(day('23:00', '07:00')))
    expect(r.level).toBe('steady')
    expect(r.driftHours).toBe(0)
    expect(r.avgSleepHours).toBe(8)
  })

  it('起床差 1 小時內 → 仍是 steady（邊界含 1.0）', () => {
    const r = computeSleepRegularity([
      day('23:00', '07:00'), day('23:00', '07:30'), day('23:00', '08:00'), day('23:00', '07:15'),
    ])
    expect(r.wakeDriftHours).toBe(1)
    expect(r.level).toBe('steady')
  })

  it('漂 2 小時 → drifting', () => {
    const r = computeSleepRegularity([
      day('23:00', '07:00'), day('23:00', '09:00'), day('23:00', '08:00'),
    ])
    expect(r.driftHours).toBe(2)
    expect(r.level).toBe('drifting')
  })

  it('週末睡到中午 → chaotic，取上床/起床較大的那個漂移', () => {
    const r = computeSleepRegularity([
      day('23:00', '07:00'), day('23:00', '07:00'), day('23:00', '07:00'),
      day('23:00', '07:00'), day('02:00', '12:00'), day('02:30', '11:30'),
    ])
    expect(r.level).toBe('chaotic')
    expect(r.wakeDriftHours).toBe(5)
    expect(r.bedDriftHours).toBe(3.5)
    expect(r.driftHours).toBe(5) // 取較大者
  })

  it('跨午夜的上床時間不會被算成巨大漂移', () => {
    const r = computeSleepRegularity([
      day('23:45', '07:00'), day('00:15', '07:00'), day('23:55', '07:00'),
    ])
    expect(r.bedDriftHours).toBe(0.5)
    expect(r.level).toBe('steady')
  })

  it('未填完整的日子會被忽略、不影響計算', () => {
    const r = computeSleepRegularity([
      day('23:00', '07:00'), day('', ''), day('23:00', '07:00'), day('23:00', ''), day('23:00', '07:00'),
    ])
    expect(r.daysFilled).toBe(3)
    expect(r.driftHours).toBe(0)
  })

  it('合規契約：任何等級的輸出都不得命中醫療合規紅線', () => {
    const cases: DayEntry[][] = [
      Array(7).fill(day('23:00', '07:00')),
      [day('23:00', '07:00'), day('23:00', '09:00'), day('23:00', '08:00')],
      [day('23:00', '07:00'), day('02:00', '12:00'), day('01:00', '11:00')],
      [day('23:00', '07:00'), day('23:00', '07:00')],
    ]
    for (const c of cases) {
      const r = computeSleepRegularity(c)
      expect(scanMedicalCompliance(`${r.headline}\n${r.detail}`)).toEqual([])
    }
  })

  it('絕不對個人輸出風險/死亡率預測（文案守門）', () => {
    const r = computeSleepRegularity([day('23:00', '07:00'), day('02:00', '12:00'), day('01:00', '11:00')])
    const text = `${r.headline}${r.detail}`
    for (const banned of ['死亡率', '風險是', '你的風險', 'HR', '早死']) {
      expect(text).not.toContain(banned)
    }
  })
})
