import { describe, it, expect } from 'vitest'
import { gradeExperiment, pointsFor, describeChange, type BodyExperiment, type DayPoint } from '@/lib/body-experiments'

const exp = (o: Partial<BodyExperiment> = {}): BodyExperiment => ({
  id: 'e1', client_id: 'c1', title: '睡滿 7.5 小時', action: null, metric: 'energy_level',
  start_date: '2026-10-01', end_date: '2026-10-14', baseline_days: 14,
  expected_direction: 'up', expected_delta: 0.5, ...o,
})

/** 從 start 開始連續 n 天，值依序取 vals 循環 */
function series(start: string, n: number, vals: number[]): DayPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i)
    return { date: d.toISOString().slice(0, 10), value: vals[i % vals.length] }
  })
}
const before = (vals: number[]) => series('2026-09-17', 14, vals)
const during = (vals: number[]) => series('2026-10-01', 14, vals)

describe('gradeExperiment', () => {
  it('還沒結束 → running，算第幾天', () => {
    const g = gradeExperiment(exp(), [...before([3]), ...during([4])], '2026-10-05')
    expect(g.status).toBe('running')
    expect(g.day).toBe(5)
    expect(g.totalDays).toBe(14)
  })

  it('資料太少 → insufficient，不硬判', () => {
    const g = gradeExperiment(exp(), [...before([3]).slice(0, 3), ...during([4])], '2026-10-15')
    expect(g.status).toBe('insufficient')
  })

  it('明顯上升且到目標 → confirmed', () => {
    const g = gradeExperiment(exp(), [...before([3, 3, 4, 3]), ...during([4, 4, 5, 4])], '2026-10-15')
    expect(g.status).toBe('confirmed')
    expect(g.delta).toBeCloseTo(1, 1)
  })

  it('上升但沒到目標幅度 → partial', () => {
    const g = gradeExperiment(exp({ expected_delta: 2 }), [...before([3, 3, 4, 3]), ...during([4, 4, 5, 4])], '2026-10-15')
    expect(g.status).toBe('partial')
  })

  it('差距在日常波動內 → no_change', () => {
    const g = gradeExperiment(exp(), [...before([2, 4, 3, 5, 1]), ...during([3, 4, 2, 5, 2])], '2026-10-15')
    expect(g.status).toBe('no_change')
  })

  it('往反方向 → refuted', () => {
    const g = gradeExperiment(exp(), [...before([4, 4, 5, 4]), ...during([3, 3, 3, 2])], '2026-10-15')
    expect(g.status).toBe('refuted')
  })

  it('預期持平、真的持平 → confirmed', () => {
    const g = gradeExperiment(exp({ expected_direction: 'stable', expected_delta: null }), [...before([3, 4]), ...during([4, 3])], '2026-10-15')
    expect(g.status).toBe('confirmed')
  })

  it('兩段都零波動但有差 → 判真的有變', () => {
    const g = gradeExperiment(exp(), [...before([3]), ...during([4])], '2026-10-15')
    expect(g.status).toBe('confirmed')
  })

  it('基準期外、實驗期外的點不算', () => {
    const far = series('2026-08-01', 10, [1])
    const g = gradeExperiment(exp(), [...far, ...before([3]), ...during([4]), ...series('2026-10-20', 5, [1])], '2026-10-25')
    expect(g.baseline.n).toBe(14)
    expect(g.during.n).toBe(14)
  })
})

describe('pointsFor / describeChange', () => {
  it('wellness 指標跳過空值；體重走 body_composition', () => {
    const w = [{ date: '2026-10-01', energy_level: 4 }, { date: '2026-10-02', energy_level: null }]
    expect(pointsFor('energy_level', w, [])).toEqual([{ date: '2026-10-01', value: 4 }])
    expect(pointsFor('weight', w, [{ date: '2026-10-01', weight: 80.2 }, { date: '2026-10-02', weight: null }])).toEqual([{ date: '2026-10-01', value: 80.2 }])
  })

  it('人話描述', () => {
    const g = gradeExperiment(exp(), [...before([3]), ...during([4])], '2026-10-15')
    expect(describeChange(exp(), g)).toBe('精力 3.0 → 4.0（+1.0）')
  })
})
