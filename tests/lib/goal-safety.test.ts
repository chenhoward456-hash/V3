import { describe, it, expect } from 'vitest'
import { checkGoalSafety } from '@/lib/goal-safety'

const NOW = new Date('2026-08-19T00:00:00Z')
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10)

describe('學員自設目標的安全驗證', () => {
  it('合理的減脂目標放行（林宥任：90.8 → 82，134 天 ≈ 0.46kg/週）', () => {
    const r = checkGoalSafety(90.8, 82, inDays(134), 'cut', NOW)
    expect(r.ok).toBe(true)
    expect(r.ratePerWeek!).toBeCloseTo(-0.46, 1)
  })

  it('八週掉二十公斤 → 擋下，並給一個做得到的日期', () => {
    const r = checkGoalSafety(90, 70, inDays(56), 'cut', NOW)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('超過安全線')
    expect(r.suggestion?.targetDate).toBeTruthy()
    // 建議的日期一定比原本的晚
    expect(r.suggestion!.targetDate! > inDays(56)).toBe(true)
  })

  it('增肌也有上限（一週 +1kg 對 80kg 的人是 1.25%，超過 0.5%）', () => {
    const r = checkGoalSafety(80, 88, inDays(56), 'bulk', NOW)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('脂肪')
  })

  it('合理的增肌目標放行（陳胤豪：83 → 86，181 天 ≈ 0.12kg/週）', () => {
    expect(checkGoalSafety(83, 86, inDays(181), 'bulk', NOW).ok).toBe(true)
  })

  it('目標日太近 → 擋下（量到的是水不是脂肪）', () => {
    const r = checkGoalSafety(90, 88, inDays(5), 'cut', NOW)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('14 天')
  })

  it('方向與現行方案相反 → 放行但提醒（賽後轉增重是合理情境）', () => {
    const r = checkGoalSafety(80, 84, inDays(120), 'cut', NOW)
    expect(r.ok).toBe(true)
    expect(r.message).toContain('反方向')
  })

  it('還沒量過體重 → 放行，但提示先記一次', () => {
    const r = checkGoalSafety(null, 80, inDays(90), 'cut', NOW)
    expect(r.ok).toBe(true)
    expect(r.message).toContain('先記一次體重')
  })

  it('離譜的體重值直接擋', () => {
    expect(checkGoalSafety(80, 20, inDays(90), 'cut', NOW).ok).toBe(false)
    expect(checkGoalSafety(80, 400, inDays(90), 'bulk', NOW).ok).toBe(false)
  })

  it('目標日超過兩年 → 擋（先設階段目標）', () => {
    expect(checkGoalSafety(90, 80, inDays(800), 'cut', NOW).ok).toBe(false)
  })
})
