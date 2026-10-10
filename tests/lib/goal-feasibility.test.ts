import { describe, it, expect } from 'vitest'
import { assessGoalFeasibility, trendKgPerWeek } from '@/lib/goal-feasibility'
import { describeProposal } from '@/lib/proposal-actions'

const today = '2026-10-10'
const series = (start: number, perWeek: number, days = 28, every = 2) =>
  Array.from({ length: Math.floor(days / every) + 1 }, (_, i) => {
    const d = new Date(Date.parse(`${today}T00:00:00Z`) - (days - i * every) * 86400000).toISOString().slice(0, 10)
    return { date: d, weight: Math.round((start + (perWeek * (i * every)) / 7) * 10) / 10 }
  })

describe('目標日到不到得了（同 goal-safety 的安全速度）', () => {
  it('震宣：兩週要掉 5.8kg、4 週沒動 → 到不了，建議日照安全速度', () => {
    const f = assessGoalFeasibility({ goalType: 'cut', targetWeight: 77, targetDate: '2026-10-25', weights: series(82.8, 0), today })!
    expect(f.verdict).toBe('unreachable')
    expect(f.projectedDate).toBeNull()
    expect(f.suggestedDate! > '2026-12-01').toBe(true)
    expect(f.line).toContain('近 4 週沒往目標走')
  })
  it('林宥任：每週掉 0.5、需要 0.52 → 在安全速度內，不提', () => {
    expect(assessGoalFeasibility({ goalType: 'cut', targetWeight: 82, targetDate: '2026-12-31', weights: series(90, -0.5), today })).toBeNull()
  })
  it('目標日已過還沒到 → passed，照現在速度推日期', () => {
    const f = assessGoalFeasibility({ goalType: 'cut', targetWeight: 80, targetDate: '2026-10-01', weights: series(84, -0.5), today })!
    expect(f.verdict).toBe('passed')
    expect(f.projectedDate).not.toBeNull()
  })
  it('最近量太少（14 天內不到 3 次）不講；已達標不講', () => {
    expect(assessGoalFeasibility({ goalType: 'cut', targetWeight: 77, targetDate: '2026-10-25', weights: [{ date: '2026-10-09', weight: 85 }], today })).toBeNull()
    expect(assessGoalFeasibility({ goalType: 'cut', targetWeight: 83, targetDate: '2026-10-25', weights: series(82.8, 0), today })).toBeNull()
  })
  it('趨勢：28 天、每週 -0.5 → 約 -0.5；點太少回 null', () => {
    expect(trendKgPerWeek(series(90, -0.5), today)!).toBeCloseTo(-0.5, 1)
    expect(trendKgPerWeek(series(90, -0.5).slice(0, 3), today)).toBeNull()
  })
  it('晨報一行描述', () => {
    expect(describeProposal({ proposal_type: 'target_date_change', current_state: { target_date: '2026-10-25', target_weight: 77 }, proposed_changes: { target_date: '2026-12-19' }, reasoning: '到不了' } as never))
      .toBe('目標日 2026-10-25 → 2026-12-19（77kg 不變）——到不了')
  })
})
