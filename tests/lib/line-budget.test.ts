import { describe, it, expect } from 'vitest'
import { budgetAllows } from '@/lib/line-budget'

const base = { limit: 200, daysInMonth: 30 }

describe('LINE 額度分級', () => {
  it('重要訊息永遠可以（就算已經 199/200）', () => {
    expect(budgetAllows({ ...base, priority: 'critical', used: 199, day: 2 })).toBe(true)
  })
  it('一般訊息：用到 90% 前可以', () => {
    expect(budgetAllows({ ...base, priority: 'normal', used: 179, day: 29 })).toBe(true)
    expect(budgetAllows({ ...base, priority: 'normal', used: 180, day: 29 })).toBe(false)
  })
  it('例行提醒照月份進度配：月初不准燒光', () => {
    // 第 2 天：配額＝200×0.6×2/30＝8
    expect(budgetAllows({ ...base, priority: 'routine', used: 7, day: 2 })).toBe(true)
    expect(budgetAllows({ ...base, priority: 'routine', used: 8, day: 2 })).toBe(false)
  })
  it('例行提醒全月最多用 60%，留 40% 給重要的', () => {
    expect(budgetAllows({ ...base, priority: 'routine', used: 119, day: 30 })).toBe(true)
    expect(budgetAllows({ ...base, priority: 'routine', used: 120, day: 30 })).toBe(false)
  })
  it('無上限方案全部放行', () => {
    expect(budgetAllows({ priority: 'routine', used: 9999, limit: null, day: 1, daysInMonth: 30 })).toBe(true)
  })
})
