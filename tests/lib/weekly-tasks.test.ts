import { describe, it, expect } from 'vitest'
import { generateWeeklyTasks, type WeeklyTaskInput } from '@/lib/weekly-tasks'

const base: WeeklyTaskInput = {
  clientName: 'x', goalType: 'cut', daysSinceLastWeight: 0, daysSinceLastNutrition: 0,
  weeklyWeights: [{ week: 0, avgWeight: 82.2 }, { week: 1, avgWeight: 82.1 }, { week: 2, avgWeight: 82.2 }],
  weeklyWeightChangeRatePct: 0, refeedSuggested: false, targetWeight: null, weeksToTarget: null,
  isLatePrep: false, latestWeight: 82.2,
}

describe('weekly tasks 文案', () => {
  it('停滯不暗示學員少報', () => {
    const t = generateWeeklyTasks(base).find(x => x.key === 'stall')!
    expect(t.detail).not.toMatch(/漏記|抓不準|據實/)
    expect(t.title).not.toMatch(/合規/)
  })
  it('增肌的人不會被叫「穩穩掉」', () => {
    const t = generateWeeklyTasks({ ...base, goalType: 'bulk', weeklyWeights: [{ week: 0, avgWeight: 85.1 }, { week: 1, avgWeight: 84.7 }] })[0]
    expect(t.key).toBe('steady')
    expect(t.detail).toContain('穩穩長')
    expect(t.detail).not.toContain('穩穩掉')
  })
  it('減脂的人照舊', () => {
    const t = generateWeeklyTasks({ ...base, weeklyWeights: [{ week: 0, avgWeight: 81.5 }, { week: 1, avgWeight: 82.2 }] })[0]
    expect(t.detail).toContain('穩穩掉')
  })
})
